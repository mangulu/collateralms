'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, AlertTriangle, GitBranch, Clock, CheckCircle2, Filter,
  Search, RefreshCw, CheckCheck, Trash2, ChevronRight, X, Building2,
  FileText, Shield, Activity
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsService, type AppNotification, type NotificationType } from '@/lib/supabase/notificationsService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = AppNotification;

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
}> = {
  brela_deadline: {
    label: 'BRELA Deadline',
    icon: Building2,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  status_change: {
    label: 'Status Change',
    icon: GitBranch,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  overdue_action: {
    label: 'Overdue Action',
    icon: AlertTriangle,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  document_expiry: {
    label: 'Document Expiry',
    icon: FileText,
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  workflow: {
    label: 'Workflow',
    icon: Shield,
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
  },
  system: {
    label: 'System',
    icon: Activity,
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-400',
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

// ─── Filter Types ─────────────────────────────────────────────────────────────

type FilterType = 'all' | NotificationType;
type ReadFilter = 'all' | 'unread' | 'read';

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overdue_action', label: 'Overdue' },
  { key: 'brela_deadline', label: 'BRELA' },
  { key: 'status_change', label: 'Status' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'document_expiry', label: 'Documents' },
  { key: 'system', label: 'System' },
];

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[notification.type];
  const IconComp = cfg.icon;

  return (
    <div
      className={`relative flex gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
        !notification.isRead ? 'bg-primary/[0.02]' : ''
      }`}
    >
      {/* Unread dot */}
      {!notification.isRead && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.border} border`}>
        <IconComp size={16} className={cfg.text} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`inline-flex items-center text-[10px] font-600 px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} uppercase tracking-wide`}>
                {cfg.label}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[notification.priority]}`} title={`${notification.priority} priority`} />
              {notification.collateralId && (
                <span className="font-mono text-[10px] text-muted-foreground">{notification.collateralId}</span>
              )}
            </div>
            <p className={`text-sm font-600 leading-snug ${notification.isRead ? 'text-foreground/80' : 'text-foreground'}`}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {notification.message}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3 mt-2">
          {notification.actionHref && notification.actionLabel && (
            <Link
              href={notification.actionHref}
              className={`inline-flex items-center gap-1 text-xs font-500 ${cfg.text} hover:underline`}
            >
              {notification.actionLabel}
              <ChevronRight size={11} />
            </Link>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {!notification.isRead && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                title="Mark as read"
              >
                <CheckCircle2 size={12} />
                Mark read
              </button>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600 transition-colors"
              title="Dismiss"
            >
              <X size={12} />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationsHubContent() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [search, setSearch] = useState('');

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await notificationsService.getAll(user?.id);
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (user?.id) notificationsService.markRead(user.id, id).catch(() => {});
  }, [user?.id]);

  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (user?.id) notificationsService.dismiss(user.id, id).catch(() => {});
  }, [user?.id]);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => {
      const unreadIds = prev.filter((n) => !n.isRead).map((n) => n.id);
      if (user?.id) notificationsService.markManyRead(user.id, unreadIds).catch(() => {});
      return prev.map((n) => ({ ...n, isRead: true }));
    });
  }, [user?.id]);

  const handleClearAll = useCallback(() => {
    setNotifications((prev) => {
      const readIds = prev.filter((n) => n.isRead).map((n) => n.id);
      if (user?.id) notificationsService.dismissMany(user.id, readIds).catch(() => {});
      return prev.filter((n) => !n.isRead);
    });
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Filtered list
  const filtered = notifications.filter((n) => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (readFilter === 'unread' && n.isRead) return false;
    if (readFilter === 'read' && !n.isRead) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !n.title.toLowerCase().includes(q) &&
        !n.message.toLowerCase().includes(q) &&
        !(n.collateralId?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const highPriorityCount = notifications.filter((n) => n.priority === 'high' && !n.isRead).length;

  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-700 text-foreground">Notifications Hub</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}${highPriorityCount > 0 ? ` · ${highPriorityCount} high priority` : ''}`
                : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
            >
              <CheckCheck size={13} />
              Mark all read
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-muted-foreground border border-border rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <Trash2 size={13} />
            Clear read
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: notifications.length, icon: Bell, color: 'text-foreground', bg: 'bg-muted/50' },
          { label: 'Unread', value: unreadCount, icon: Bell, color: 'text-primary', bg: 'bg-primary/5' },
          {
            label: 'High Priority',
            value: notifications.filter((n) => n.priority === 'high').length,
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
          {
            label: 'Overdue',
            value: notifications.filter((n) => n.type === 'overdue_action').length,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
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

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        {/* Type filter tabs */}
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? notifications.length
                : notifications.filter((n) => n.type === tab.key).length;
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
                  <span
                    className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${
                      typeFilter === tab.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + read filter row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notifications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden bg-white">
            {(['all', 'unread', 'read'] as ReadFilter[]).map((rf) => (
              <button
                key={rf}
                onClick={() => setReadFilter(rf)}
                className={`px-3 py-1.5 text-xs font-500 capitalize transition-colors ${
                  readFilter === rf
                    ? 'bg-primary text-white' :'text-muted-foreground hover:bg-muted'
                }`}
              >
                {rf}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <Filter size={12} />
            <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Notification list */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skel-${i}`} className="flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bell size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-500 text-foreground mb-1">No notifications found</p>
            <p className="text-xs text-muted-foreground">
              {search ? 'Try adjusting your search or filters.' : 'You\'re all caught up!'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
