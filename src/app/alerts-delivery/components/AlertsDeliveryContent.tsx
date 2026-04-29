'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { MessageSquare, RefreshCw, RotateCcw, Search, X, Filter, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Send, User, ArrowUpDown, Loader2, Shield, Building2, GitBranch, Activity, FileText, Inbox } from 'lucide-react';

import { smsAlertService, type SmsAlert, type SmsAlertStatus, type SmsAlertType } from '@/lib/supabase/smsAlertService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelFilter = 'all' | 'sms' | 'email';
type StatusFilter = 'all' | 'SENT' | 'FAILED' | 'PENDING' | 'DELIVERED';
type SortField = 'newest' | 'oldest' | 'status';

interface RecipientHistoryEntry {
  phone: string;
  name?: string;
  totalSent: number;
  totalFailed: number;
  lastSentAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SmsAlertStatus, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
}> = {
  SENT: {
    label: 'Sent',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  DELIVERED: {
    label: 'Delivered',
    icon: CheckCircle2,
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  PENDING: {
    label: 'Pending',
    icon: Clock,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
};

const ALERT_TYPE_CONFIG: Record<SmsAlertType, {
  label: string;
  icon: React.ElementType;
  text: string;
  bg: string;
}> = {
  FRAUD_DETECTION: { label: 'Fraud Detection', icon: Shield, text: 'text-red-700', bg: 'bg-red-50' },
  BRELA_DEADLINE: { label: 'BRELA Deadline', icon: Building2, text: 'text-blue-700', bg: 'bg-blue-50' },
  APPROVAL_REQUEST: { label: 'Approval Request', icon: GitBranch, text: 'text-violet-700', bg: 'bg-violet-50' },
  OVERDUE_COLLATERAL: { label: 'Overdue Collateral', icon: AlertTriangle, text: 'text-amber-700', bg: 'bg-amber-50' },
  CUSTODY_DISCREPANCY: { label: 'Custody Discrepancy', icon: Activity, text: 'text-orange-700', bg: 'bg-orange-50' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildRecipientHistory(alerts: SmsAlert[]): RecipientHistoryEntry[] {
  const map = new Map<string, RecipientHistoryEntry>();
  for (const a of alerts) {
    const key = a.recipientPhone;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        phone: a.recipientPhone,
        name: a.recipientName,
        totalSent: a.status === 'SENT' || a.status === 'DELIVERED' ? 1 : 0,
        totalFailed: a.status === 'FAILED' ? 1 : 0,
        lastSentAt: a.createdAt,
      });
    } else {
      if (a.status === 'SENT' || a.status === 'DELIVERED') existing.totalSent++;
      if (a.status === 'FAILED') existing.totalFailed++;
      if (new Date(a.createdAt) > new Date(existing.lastSentAt)) existing.lastSentAt = a.createdAt;
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime());
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: SmsAlert;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onRetry: (alert: SmsAlert) => void;
  retrying: boolean;
}

function AlertRow({ alert, expanded, onToggleExpand, onRetry, retrying }: AlertRowProps) {
  const statusCfg = STATUS_CONFIG[alert.status];
  const typeCfg = ALERT_TYPE_CONFIG[alert.alertType] ?? {
    label: alert.alertType,
    icon: FileText,
    text: 'text-gray-600',
    bg: 'bg-gray-50',
  };
  const StatusIcon = statusCfg.icon;
  const TypeIcon = typeCfg.icon;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors">
        {/* Channel icon */}
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100 mt-0.5">
          <MessageSquare size={14} className="text-emerald-700" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Meta badges */}
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-600 px-1.5 py-0.5 rounded border ${typeCfg.bg} ${typeCfg.text} border-current/20 uppercase tracking-wide`}>
                  <TypeIcon size={9} />
                  {typeCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-600 px-1.5 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                  <StatusIcon size={9} />
                  {statusCfg.label}
                </span>
                {alert.collateralId && (
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {alert.collateralId}
                  </span>
                )}
              </div>

              {/* Recipient */}
              <div className="flex items-center gap-1.5 mb-1">
                <User size={11} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-500 text-foreground">
                  {alert.recipientName ?? 'Unknown Recipient'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{alert.recipientPhone}</span>
              </div>

              {/* Message preview */}
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {alert.message}
              </p>

              {/* Expanded details */}
              {expanded && (
                <div className="mt-3 space-y-2">
                  <div className="p-3 bg-muted/30 rounded-lg border border-border">
                    <p className="text-xs font-500 text-foreground/70 mb-1">Full Message</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{alert.message}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border">
                      <p className="text-muted-foreground mb-0.5">Sent At</p>
                      <p className="font-500 text-foreground">{formatAbsoluteTime(alert.createdAt)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border">
                      <p className="text-muted-foreground mb-0.5">Updated At</p>
                      <p className="font-500 text-foreground">{formatAbsoluteTime(alert.updatedAt)}</p>
                    </div>
                    {alert.twilioMessageSid && (
                      <div className="p-2.5 rounded-lg bg-muted/20 border border-border col-span-2">
                        <p className="text-muted-foreground mb-0.5">Twilio Message SID</p>
                        <p className="font-mono text-xs text-foreground">{alert.twilioMessageSid}</p>
                      </div>
                    )}
                    {alert.errorMessage && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 col-span-2">
                        <p className="text-red-600 mb-0.5 font-500">Error</p>
                        <p className="text-red-700 text-xs">{alert.errorMessage}</p>
                      </div>
                    )}
                    {alert.sentBy && (
                      <div className="p-2.5 rounded-lg bg-muted/20 border border-border">
                        <p className="text-muted-foreground mb-0.5">Sent By</p>
                        <p className="font-500 text-foreground">{alert.sentBy}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(alert.createdAt)}
              </span>
              <div className="flex items-center gap-1">
                {alert.status === 'FAILED' && (
                  <button
                    onClick={() => onRetry(alert)}
                    disabled={retrying}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-500 text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    title="Retry sending"
                  >
                    {retrying ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                    Retry
                  </button>
                )}
                <button
                  onClick={() => onToggleExpand(alert.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recipient History Row ────────────────────────────────────────────────────

function RecipientRow({ entry }: { entry: RecipientHistoryEntry }) {
  const successRate = entry.totalSent + entry.totalFailed > 0
    ? Math.round((entry.totalSent / (entry.totalSent + entry.totalFailed)) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User size={14} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-500 text-foreground truncate">{entry.name ?? 'Unknown'}</p>
        <p className="text-xs font-mono text-muted-foreground">{entry.phone}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-xs">
        <div className="text-center">
          <p className="font-600 text-emerald-700">{entry.totalSent}</p>
          <p className="text-muted-foreground">Sent</p>
        </div>
        <div className="text-center">
          <p className="font-600 text-red-600">{entry.totalFailed}</p>
          <p className="text-muted-foreground">Failed</p>
        </div>
        <div className="text-center">
          <p className={`font-600 ${successRate >= 80 ? 'text-emerald-700' : successRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {successRate}%
          </p>
          <p className="text-muted-foreground">Rate</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-muted-foreground">{formatRelativeTime(entry.lastSentAt)}</p>
          <p className="text-muted-foreground">Last sent</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'PENDING', label: 'Pending' },
];

type ActiveTab = 'history' | 'recipients';

export default function AlertsDeliveryContent() {
  const [alerts, setAlerts] = useState<SmsAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('history');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<SmsAlertType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortField>('newest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await smsAlertService.fetchAlerts(200);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  const handleRetry = useCallback(async (alert: SmsAlert) => {
    setRetryingId(alert.id);
    setRetryFeedback(null);
    try {
      const result = await smsAlertService.sendAlertViaApi({
        to: alert.recipientPhone,
        recipientName: alert.recipientName,
        alertType: alert.alertType,
        collateralId: alert.collateralId,
        actionUrl: alert.actionUrl,
        message: alert.message,
      });
      if (result.success) {
        setRetryFeedback({ id: alert.id, success: true, message: 'SMS resent successfully.' });
        // Refresh list to show new entry
        await loadAlerts();
      } else {
        setRetryFeedback({ id: alert.id, success: false, message: result.error ?? 'Retry failed.' });
      }
    } catch (err: any) {
      setRetryFeedback({ id: alert.id, success: false, message: err?.message ?? 'Retry failed.' });
    } finally {
      setRetryingId(null);
      setTimeout(() => setRetryFeedback(null), 4000);
    }
  }, [loadAlerts]);

  // Derived stats
  const totalSent = alerts.filter((a) => a.status === 'SENT' || a.status === 'DELIVERED').length;
  const totalFailed = alerts.filter((a) => a.status === 'FAILED').length;
  const totalPending = alerts.filter((a) => a.status === 'PENDING').length;
  const deliveryRate = alerts.length > 0 ? Math.round((totalSent / alerts.length) * 100) : 0;

  // Filtered list
  const filtered = alerts
    .filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (typeFilter !== 'all' && a.alertType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !a.recipientPhone.toLowerCase().includes(q) &&
          !(a.recipientName?.toLowerCase().includes(q)) &&
          !a.message.toLowerCase().includes(q) &&
          !(a.collateralId?.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      // Sort by status: FAILED first, then PENDING, then SENT
      const order: Record<SmsAlertStatus, number> = { FAILED: 0, PENDING: 1, SENT: 2, DELIVERED: 3 };
      return order[a.status] - order[b.status];
    });

  const recipientHistory = buildRecipientHistory(alerts);

  const ALERT_TYPE_TABS: { key: SmsAlertType | 'all'; label: string }[] = [
    { key: 'all', label: 'All Types' },
    { key: 'FRAUD_DETECTION', label: 'Fraud' },
    { key: 'BRELA_DEADLINE', label: 'BRELA' },
    { key: 'APPROVAL_REQUEST', label: 'Approvals' },
    { key: 'OVERDUE_COLLATERAL', label: 'Overdue' },
    { key: 'CUSTODY_DISCREPANCY', label: 'Custody' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Send size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-700 text-foreground">Alert Delivery Log</h1>
            <p className="text-sm text-muted-foreground">
              SMS delivery history, failure tracking, and retry controls
            </p>
          </div>
        </div>
        <button
          onClick={loadAlerts}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Retry Feedback Toast */}
      {retryFeedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-500 ${
          retryFeedback.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-red-50 border-red-200 text-red-700'
        }`}>
          {retryFeedback.success
            ? <CheckCircle2 size={15} />
            : <XCircle size={15} />}
          {retryFeedback.message}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Alerts', value: alerts.length, icon: Send, color: 'text-foreground', bg: 'bg-muted/50' },
          { label: 'Delivered', value: totalSent, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Failed', value: totalFailed, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Delivery Rate', value: `${deliveryRate}%`, icon: Activity, color: deliveryRate >= 80 ? 'text-emerald-700' : deliveryRate >= 50 ? 'text-amber-700' : 'text-red-700', bg: deliveryRate >= 80 ? 'bg-emerald-50' : deliveryRate >= 50 ? 'bg-amber-50' : 'bg-red-50' },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-xl border border-border ${stat.bg} px-4 py-3 flex items-center gap-3`}>
              <StatIcon size={18} className={stat.color} />
              <div>
                <p className={`text-lg font-700 leading-none ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs: History / Recipients */}
      <div className="flex items-center gap-0 border-b border-border">
        {([
          { key: 'history', label: 'Delivery History', icon: MessageSquare },
          { key: 'recipients', label: 'Recipient History', icon: User },
        ] as { key: ActiveTab; label: string; icon: React.ElementType }[]).map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-500 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden flex flex-col">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === 'all'
                ? alerts.length
                : alerts.filter((a) => a.status === tab.key).length;
              const cfg = tab.key !== 'all' ? STATUS_CONFIG[tab.key as SmsAlertStatus] : null;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-500 whitespace-nowrap border-b-2 transition-colors ${
                    statusFilter === tab.key
                      ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {cfg && <cfg.icon size={12} className={cfg.text} />}
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${
                      statusFilter === tab.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by recipient, message, collateral…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Alert type filter */}
            <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden bg-white overflow-x-auto max-w-xs">
              {ALERT_TYPE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-500 whitespace-nowrap transition-colors ${
                    typeFilter === tab.key ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <button
              onClick={() => setSortOrder((s) => s === 'newest' ? 'oldest' : s === 'oldest' ? 'status' : 'newest')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors bg-white"
            >
              <ArrowUpDown size={12} />
              {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'By Status'}
            </button>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <Filter size={12} />
              <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Alert List */}
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`skel-${i}`} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-500 text-foreground mb-1">No alerts found</p>
              <p className="text-xs text-muted-foreground">
                {search ? 'Try adjusting your search or filters.' : 'No SMS alerts have been sent yet.'}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  expanded={expandedIds.has(alert.id)}
                  onToggleExpand={handleToggleExpand}
                  onRetry={handleRetry}
                  retrying={retryingId === alert.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'recipients' && (
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={14} className="text-muted-foreground" />
              <span className="text-sm font-500 text-foreground">
                {recipientHistory.length} unique recipient{recipientHistory.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Sorted by most recent activity</span>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`rskel-${i}`} className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted animate-pulse rounded w-1/3" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : recipientHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <User size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-500 text-foreground mb-1">No recipients yet</p>
              <p className="text-xs text-muted-foreground">Recipient history will appear here once alerts are sent.</p>
            </div>
          ) : (
            <div>
              {recipientHistory.map((entry) => (
                <RecipientRow key={entry.phone} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
