'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, RefreshCw, Filter, Eye, EyeOff,
  TrendingDown, Clock, BarChart2, ShieldAlert, ChevronDown, ChevronUp,
  X, Loader2, Search, CalendarClock, Zap
} from 'lucide-react';
import {
  listValuationFlags,
  getValuationFlagStats,
  acknowledgeFlag,
  resolveFlag,
  suppressFlag,
  scanAndCreateOverdueFlags,
  type ValuationPricingFlag,
  type ValuationFlagStatus,
  type ValuationFlagSeverity,
  type ValuationFlagType,
} from '@/lib/supabase/valuationFlagService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const FLAG_TYPE_CONFIG: Record<ValuationFlagType, { label: string; icon: React.ReactNode; color: string }> = {
  overdue_valuation:            { label: 'Overdue Valuation',           icon: <Clock size={13} />,       color: 'text-red-600 bg-red-50 border-red-200' },
  market_unavailable:           { label: 'Market Unavailable',          icon: <TrendingDown size={13} />, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  theoretical_pricing_required: { label: 'Theoretical Pricing',         icon: <BarChart2 size={13} />,    color: 'text-amber-600 bg-amber-50 border-amber-200' },
  stale_valuation:              { label: 'Stale Valuation',             icon: <CalendarClock size={13} />,color: 'text-purple-600 bg-purple-50 border-purple-200' },
  no_market_data:               { label: 'No Market Data',              icon: <ShieldAlert size={13} />,  color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const SEVERITY_CONFIG: Record<ValuationFlagSeverity, { label: string; dot: string; badge: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'High',     dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Medium',   dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:      { label: 'Low',      dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const STATUS_CONFIG: Record<ValuationFlagStatus, { label: string; badge: string }> = {
  open:         { label: 'Open',         badge: 'bg-red-100 text-red-700 border-red-200' },
  acknowledged: { label: 'Acknowledged', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolved:     { label: 'Resolved',     badge: 'bg-green-100 text-green-700 border-green-200' },
  suppressed:   { label: 'Suppressed',   badge: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const PRICING_METHOD_LABELS: Record<string, string> = {
  market_value:     'Market Value',
  theoretical:      'Theoretical',
  forced_sale:      'Forced Sale',
  desktop_estimate: 'Desktop Estimate',
  book_value:       'Book Value',
};

function formatCurrency(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1e9) return `TZS ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `TZS ${(v / 1e6).toFixed(1)}M`;
  return `TZS ${v.toLocaleString()}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ValuationPricingFlagsContent() {
  const { userProfile } = useAuth();

  const [flags, setFlags] = useState<ValuationPricingFlag[]>([]);
  const [stats, setStats] = useState({
    total: 0, open: 0, acknowledged: 0, resolved: 0,
    critical: 0, high: 0, overdueCount: 0, marketUnavailableCount: 0, theoreticalPricingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<ValuationFlagStatus | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<ValuationFlagSeverity | 'all'>('all');
  const [filterType, setFilterType] = useState<ValuationFlagType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [resolveModal, setResolveModal] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [suppressModal, setSuppressModal] = useState<string | null>(null);
  const [suppressDate, setSuppressDate] = useState('');
  const [ackModal, setAckModal] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, s] = await Promise.all([
        listValuationFlags({
          status: filterStatus !== 'all' ? filterStatus : undefined,
          severity: filterSeverity !== 'all' ? filterSeverity : undefined,
          flagType: filterType !== 'all' ? filterType : undefined,
        }),
        getValuationFlagStats(),
      ]);
      setFlags(f);
      setStats(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity, filterType]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    if (!userProfile?.id) return;
    setScanning(true);
    setError(null);
    try {
      const count = await scanAndCreateOverdueFlags(userProfile.id);
      setSuccessMsg(count > 0 ? `Scan complete — ${count} new flag(s) created.` : 'Scan complete — no new overdue valuations found.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!ackModal || !userProfile?.id) return;
    setActionLoading(ackModal);
    try {
      const updated = await acknowledgeFlag(ackModal, userProfile.id, ackNote || undefined);
      setFlags((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSuccessMsg('Flag acknowledged.');
      setAckModal(null);
      setAckNote('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal || !userProfile?.id) return;
    setActionLoading(resolveModal);
    try {
      const updated = await resolveFlag(resolveModal, userProfile.id, resolveNote);
      setFlags((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSuccessMsg('Flag resolved.');
      setResolveModal(null);
      setResolveNote('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuppress = async () => {
    if (!suppressModal || !userProfile?.id || !suppressDate) return;
    setActionLoading(suppressModal);
    try {
      const updated = await suppressFlag(suppressModal, userProfile.id, suppressDate);
      setFlags((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSuccessMsg('Flag suppressed until ' + formatDate(suppressDate) + '.');
      setSuppressModal(null);
      setSuppressDate('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = flags.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      (f.collateralDescription ?? '').toLowerCase().includes(q) ||
      (f.collateralType ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Valuation Pricing Flags</h1>
          <p className="text-sm text-gray-500 mt-1">
            Alerts for overdue or market-unavailable valuations requiring theoretical pricing — prevents incomplete LTV calculations
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Scan Overdue
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Toast messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={14} />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 size={14} />{successMsg}
          <button className="ml-auto" onClick={() => setSuccessMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Flags',   value: stats.total,                  color: 'text-gray-900' },
          { label: 'Open',          value: stats.open,                   color: 'text-red-600' },
          { label: 'Acknowledged',  value: stats.acknowledged,           color: 'text-amber-600' },
          { label: 'Critical',      value: stats.critical,               color: 'text-red-700' },
          { label: 'Overdue',       value: stats.overdueCount,           color: 'text-orange-600' },
          { label: 'No Market Data',value: stats.marketUnavailableCount, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Theoretical Pricing Warning Banner */}
      {stats.open > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {stats.open} collateral item{stats.open !== 1 ? 's' : ''} using theoretical pricing
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              LTV calculations for these items may be incomplete or inaccurate. Review and resolve flags to restore market-based valuations.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-gray-400 shrink-0" />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flags..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_CONFIG) as ValuationFlagStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Severities</option>
          {(Object.keys(SEVERITY_CONFIG) as ValuationFlagSeverity[]).map((s) => (
            <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Flag Types</option>
          {(Object.keys(FLAG_TYPE_CONFIG) as ValuationFlagType[]).map((t) => (
            <option key={t} value={t}>{FLAG_TYPE_CONFIG[t].label}</option>
          ))}
        </select>
        {(filterStatus !== 'all' || filterSeverity !== 'all' || filterType !== 'all' || search) && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterSeverity('all'); setFilterType('all'); setSearch(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Flag List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 size={40} className="text-green-400 mb-3" />
          <p className="text-gray-600 font-medium">No valuation pricing flags found</p>
          <p className="text-sm text-gray-400 mt-1">All collateral valuations are current and market-priced</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((flag) => {
            const typeConf = FLAG_TYPE_CONFIG[flag.flagType];
            const sevConf = SEVERITY_CONFIG[flag.severity];
            const statConf = STATUS_CONFIG[flag.flagStatus];
            const isExpanded = expandedId === flag.id;
            const isActioning = actionLoading === flag.id;

            return (
              <div
                key={flag.id}
                className={`bg-white border rounded-xl overflow-hidden transition-all ${
                  flag.severity === 'critical' ? 'border-red-300' :
                  flag.severity === 'high' ? 'border-orange-200' : 'border-gray-200'
                }`}
              >
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Severity dot */}
                    <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${sevConf.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm leading-snug">{flag.title}</p>
                          {flag.collateralDescription && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {flag.collateralDescription}
                              {flag.collateralType && <span className="ml-1 text-gray-400">· {flag.collateralType}</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${sevConf.badge}`}>
                            {sevConf.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${statConf.badge}`}>
                            {statConf.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${typeConf.color}`}>
                            {typeConf.icon}
                            {typeConf.label}
                          </span>
                        </div>
                      </div>

                      {/* Key metrics row */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {flag.daysOverdue > 0 && (
                          <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <Clock size={11} />{flag.daysOverdue} days overdue
                          </span>
                        )}
                        {flag.pricingMethodUsed && flag.pricingMethodUsed !== 'market_value' && (
                          <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                            <BarChart2 size={11} />Pricing: {PRICING_METHOD_LABELS[flag.pricingMethodUsed] ?? flag.pricingMethodUsed}
                          </span>
                        )}
                        {flag.currentLtv != null && (
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <TrendingDown size={11} />LTV: {(flag.currentLtv * 100).toFixed(1)}%
                          </span>
                        )}
                        {flag.theoreticalValue != null && (
                          <span className="text-xs text-gray-500">
                            Theoretical: {formatCurrency(flag.theoreticalValue)}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatDate(flag.createdAt)}
                        </span>
                      </div>

                      {/* LTV impact note */}
                      {flag.ltvImpactNote && (
                        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                          ⚠ {flag.ltvImpactNote}
                        </p>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : flag.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>

                  {/* Action buttons */}
                  {flag.flagStatus === 'open' && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => { setAckModal(flag.id); setAckNote(''); }}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                      >
                        <Eye size={12} />Acknowledge
                      </button>
                      <button
                        onClick={() => { setResolveModal(flag.id); setResolveNote(''); }}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 size={12} />Resolve
                      </button>
                      <button
                        onClick={() => { setSuppressModal(flag.id); setSuppressDate(''); }}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        <EyeOff size={12} />Suppress
                      </button>
                    </div>
                  )}
                  {flag.flagStatus === 'acknowledged' && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => { setResolveModal(flag.id); setResolveNote(''); }}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 size={12} />Mark Resolved
                      </button>
                      {flag.acknowledgedByName && (
                        <span className="text-xs text-gray-400 ml-auto">
                          Acknowledged by {flag.acknowledgedByName} · {formatDate(flag.acknowledgedAt)}
                        </span>
                      )}
                    </div>
                  )}
                  {flag.flagStatus === 'resolved' && flag.resolvedByName && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-green-700">
                        Resolved by {flag.resolvedByName} on {formatDate(flag.resolvedAt)}
                        {flag.resolutionNote && <span className="text-gray-500"> — {flag.resolutionNote}</span>}
                      </p>
                    </div>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                    {flag.description && (
                      <p className="text-sm text-gray-700">{flag.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Last Valuation</p>
                        <p className="text-gray-700 font-medium">{formatDate(flag.lastValuationDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Next Due</p>
                        <p className="text-gray-700 font-medium">{formatDate(flag.nextValuationDue)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Pricing Method</p>
                        <p className="text-gray-700 font-medium">{PRICING_METHOD_LABELS[flag.pricingMethodUsed] ?? flag.pricingMethodUsed}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Auto-Generated</p>
                        <p className="text-gray-700 font-medium">{flag.autoGenerated ? 'Yes (System)' : 'Manual'}</p>
                      </div>
                      {flag.theoreticalValue != null && (
                        <div>
                          <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Theoretical Value</p>
                          <p className="text-gray-700 font-medium">{formatCurrency(flag.theoreticalValue)}</p>
                        </div>
                      )}
                      {flag.marketValue != null && (
                        <div>
                          <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Market Value</p>
                          <p className="text-gray-700 font-medium">{formatCurrency(flag.marketValue)}</p>
                        </div>
                      )}
                      {flag.currentLtv != null && (
                        <div>
                          <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Current LTV</p>
                          <p className="text-gray-700 font-medium">{(flag.currentLtv * 100).toFixed(2)}%</p>
                        </div>
                      )}
                    </div>
                    {flag.officerNote && (
                      <div className="mt-2 p-2 bg-white border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500 font-medium mb-0.5">Officer Note</p>
                        <p className="text-xs text-gray-700">{flag.officerNote}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Acknowledge Modal */}
      {ackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Acknowledge Flag</h3>
            <p className="text-sm text-gray-500 mb-4">Confirm you have reviewed this flag. Add an optional note.</p>
            <textarea
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder="Officer note (optional)..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAckModal(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleAcknowledge}
                disabled={actionLoading === ackModal}
                className="flex-1 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading === ackModal && <Loader2 size={13} className="animate-spin" />}
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Resolve Flag</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a resolution note explaining how the valuation issue was addressed.</p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="e.g. New valuation completed and approved on 07/09/2026..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setResolveModal(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleResolve}
                disabled={!resolveNote.trim() || actionLoading === resolveModal}
                className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading === resolveModal && <Loader2 size={13} className="animate-spin" />}
                Resolve Flag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suppress Modal */}
      {suppressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Suppress Flag</h3>
            <p className="text-sm text-gray-500 mb-4">Suppress this flag until a specified date (e.g. pending a scheduled revaluation).</p>
            <label className="block text-xs font-medium text-gray-700 mb-1">Suppress Until</label>
            <input
              type="date"
              value={suppressDate}
              onChange={(e) => setSuppressDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setSuppressModal(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSuppress}
                disabled={!suppressDate || actionLoading === suppressModal}
                className="flex-1 px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading === suppressModal && <Loader2 size={13} className="animate-spin" />}
                Suppress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
