'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Inbox, Mail, MessageSquare, AlertTriangle, Search, RefreshCw, CheckCheck, Trash2, X, Filter, ChevronDown, Shield, GitBranch, Building2, FileText, Activity, Eye, EyeOff, ArrowUpDown } from 'lucide-react';
import { alertsInboxService, type InboxAlert } from '@/lib/supabase/alertsInboxService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertChannel = 'sms' | 'email';
type AlertType = 'fraud_detection' | 'brela_deadline' | 'approval_request' | 'overdue_collateral' | 'status_change' | 'system';
type ReadStatus = 'all' | 'unread' | 'read';
type ChannelFilter = 'all' | AlertChannel;
type TypeFilter = 'all' | AlertType;
type SortOrder = 'newest' | 'oldest' | 'priority';

// Use InboxAlert as Alert for backward compat
type Alert = InboxAlert;

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AlertType, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
}> = {
  fraud_detection: {
    label: 'Fraud Detection',
    icon: Shield,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  brela_deadline: {
    label: 'BRELA Deadline',
    icon: Building2,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  approval_request: {
    label: 'Approval Request',
    icon: GitBranch,
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
  },
  overdue_collateral: {
    label: 'Overdue Collateral',
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  status_change: {
    label: 'Status Change',
    icon: Activity,
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  system: {
    label: 'System',
    icon: FileText,
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
};

const PRIORITY_CONFIG: Record<string, { dot: string; label: string }> = {
  high: { dot: 'bg-red-500', label: 'High' },
  medium: { dot: 'bg-amber-500', label: 'Medium' },
  low: { dot: 'bg-blue-400', label: 'Low' },
};

const CHANNEL_CONFIG: Record<AlertChannel, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  sms: { icon: MessageSquare, bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'SMS' },
  email: { icon: Mail, bg: 'bg-sky-50', text: 'text-sky-700', label: 'Email' },
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

// ─── Alert Row ────────────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: Alert;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onDelete: (id: string) => void;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

function AlertRow({ alert, selected, onSelect, onMarkRead, onMarkUnread, onDelete, expanded, onToggleExpand }: AlertRowProps) {
  const typeCfg = TYPE_CONFIG[alert.type];
  const channelCfg = CHANNEL_CONFIG[alert.channel];
  const TypeIcon = typeCfg.icon;
  const ChannelIcon = channelCfg.icon;

  return (
    <div className={`border-b border-border last:border-0 transition-colors ${!alert.isRead ? 'bg-primary/[0.025]' : 'bg-white'} ${selected ? 'bg-primary/5' : ''}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Unread indicator */}
        <div className="flex items-center pt-1 shrink-0">
          <span className={`w-2 h-2 rounded-full mr-2 shrink-0 transition-opacity ${!alert.isRead ? 'bg-primary opacity-100' : 'opacity-0'}`} />
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(alert.id, e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
          />
        </div>

        {/* Channel badge */}
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${channelCfg.bg} ${channelCfg.text} border-current/20 mt-0.5`}>
          <ChannelIcon size={14} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`inline-flex items-center gap-1 text-[10px] font-600 px-1.5 py-0.5 rounded border ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border} uppercase tracking-wide`}>
                  <TypeIcon size={9} />
                  {typeCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-500 px-1.5 py-0.5 rounded ${channelCfg.bg} ${channelCfg.text}`}>
                  <ChannelIcon size={9} />
                  {channelCfg.label}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_CONFIG[alert.priority].dot}`} title={`${PRIORITY_CONFIG[alert.priority].label} priority`} />
                {alert.collateralId && (
                  <span className="font-mono text-[10px] text-muted-foreground">{alert.collateralId}</span>
                )}
              </div>

              {/* Subject */}
              <p className={`text-sm leading-snug mb-0.5 ${!alert.isRead ? 'font-600 text-foreground' : 'font-500 text-foreground/80'}`}>
                {alert.subject}
              </p>

              {/* Sender / recipient */}
              <p className="text-[11px] text-muted-foreground">
                {alert.channel === 'email' ? `From: ${alert.sender}` : `To: ${alert.recipient}`}
              </p>

              {/* Expanded body */}
              {expanded && (
                <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
                  <p className="text-sm text-foreground/80 leading-relaxed">{alert.body}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Received: {formatAbsoluteTime(alert.receivedAt)}
                    {alert.channel === 'email' && ` · To: ${alert.recipient}`}
                  </p>
                  {alert.actionLabel && alert.actionHref && (
                    <a
                      href={alert.actionHref}
                      className={`inline-flex items-center gap-1 mt-2 text-xs font-500 ${typeCfg.text} hover:underline`}
                    >
                      {alert.actionLabel} →
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Right side: time + actions */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(alert.receivedAt)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleExpand(alert.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {alert.isRead ? (
                  <button
                    onClick={() => onMarkUnread(alert.id)}
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Mark as unread"
                  >
                    <EyeOff size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => onMarkRead(alert.id)}
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Mark as read"
                  >
                    <Eye size={13} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(alert.id)}
                  className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TYPE_FILTER_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'fraud_detection', label: 'Fraud' },
  { key: 'brela_deadline', label: 'BRELA' },
  { key: 'approval_request', label: 'Approvals' },
  { key: 'overdue_collateral', label: 'Overdue' },
  { key: 'status_change', label: 'Status' },
  { key: 'system', label: 'System' },
];

export default function AlertsInboxContent() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadStatus>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await alertsInboxService.fetchAlerts(200);
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

  const handleRefresh = useCallback(() => {
    setSelectedIds(new Set());
    loadAlerts();
  }, [loadAlerts]);

  const handleMarkRead = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    await alertsInboxService.markRead(id);
  }, []);

  const handleMarkUnread = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: false } : a)));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    await alertsInboxService.deleteAlert(id);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (checked) s.add(id); else s.delete(id);
      return s;
    });
  }, []);

  // Filtered + sorted list
  const filtered = alerts
    .filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (channelFilter !== 'all' && a.channel !== channelFilter) return false;
      if (readFilter === 'unread' && a.isRead) return false;
      if (readFilter === 'read' && !a.isRead) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !a.subject.toLowerCase().includes(q) &&
          !a.body.toLowerCase().includes(q) &&
          !a.sender.toLowerCase().includes(q) &&
          !(a.collateralId?.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
      if (sortOrder === 'oldest') return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });

  const unreadCount = alerts.filter((a) => !a.isRead).length;
  const smsCount = alerts.filter((a) => a.channel === 'sms').length;
  const emailCount = alerts.filter((a) => a.channel === 'email').length;
  const highPriorityUnread = alerts.filter((a) => !a.isRead && a.priority === 'high').length;

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const someSelected = selectedIds.size > 0;

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    setAlerts((prev) => prev.map((a) => selectedIds.has(a.id) ? { ...a, isRead: true } : a));
    setSelectedIds(new Set());
    await Promise.all(ids.map((id) => alertsInboxService.markRead(id)));
  };

  const handleBulkMarkUnread = () => {
    setAlerts((prev) => prev.map((a) => selectedIds.has(a.id) ? { ...a, isRead: false } : a));
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setAlerts((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    await Promise.all(ids.map((id) => alertsInboxService.deleteAlert(id)));
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Inbox size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-700 text-foreground">Alerts Inbox</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}${highPriorityUnread > 0 ? ` · ${highPriorityUnread} high priority` : ''}`
                : 'All alerts read'}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Alerts', value: alerts.length, icon: Inbox, color: 'text-foreground', bg: 'bg-muted/50' },
          { label: 'Unread', value: unreadCount, icon: Bell, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'SMS Alerts', value: smsCount, icon: MessageSquare, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Email Alerts', value: emailCount, icon: Mail, color: 'text-sky-700', bg: 'bg-sky-50' },
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

      {/* Main Panel */}
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden flex flex-col">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
          {TYPE_FILTER_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? alerts.length
              : alerts.filter((a) => a.type === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-500 whitespace-nowrap border-b-2 transition-colors ${
                  typeFilter === tab.key
                    ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${
                    typeFilter === tab.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
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
              placeholder="Search alerts…"
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

          {/* Channel filter */}
          <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden bg-white">
            {(['all', 'sms', 'email'] as ChannelFilter[]).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-500 capitalize transition-colors ${
                  channelFilter === ch ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {ch === 'sms' && <MessageSquare size={11} />}
                {ch === 'email' && <Mail size={11} />}
                {ch === 'all' ? 'All Channels' : ch.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Read status filter */}
          <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden bg-white">
            {(['all', 'unread', 'read'] as ReadStatus[]).map((rs) => (
              <button
                key={rs}
                onClick={() => setReadFilter(rs)}
                className={`px-3 py-1.5 text-xs font-500 capitalize transition-colors ${
                  readFilter === rs ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {rs}
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            onClick={() => setSortOrder((s) => s === 'newest' ? 'oldest' : s === 'oldest' ? 'priority' : 'newest')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors bg-white"
          >
            <ArrowUpDown size={12} />
            {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Priority'}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <Filter size={12} />
            <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border bg-primary/5 transition-all ${someSelected ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 py-0 border-0 overflow-hidden'}`}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
          />
          <span className="text-sm font-500 text-primary">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleBulkMarkRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
            >
              <Eye size={12} />
              Mark Read
            </button>
            <button
              onClick={handleBulkMarkUnread}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <EyeOff size={12} />
              Mark Unread
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Select all row (when no selection) */}
        {!someSelected && filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/10">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">Select all {filtered.length} alerts</span>
            {unreadCount > 0 && (
              <button
                onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-500 text-primary hover:underline"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>
        )}

        {/* Alert List */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skel-${i}`} className="flex gap-4">
                <div className="w-4 h-4 rounded bg-muted animate-pulse shrink-0 mt-1" />
                <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
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
              {search ? 'Try adjusting your search or filters.' : 'Your inbox is empty.'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                selected={selectedIds.has(alert.id)}
                onSelect={handleSelect}
                onMarkRead={handleMarkRead}
                onMarkUnread={handleMarkUnread}
                onDelete={handleDelete}
                expanded={expandedIds.has(alert.id)}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Needed for KPI strip icon reference
function Bell(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 24, ...rest } = props;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
