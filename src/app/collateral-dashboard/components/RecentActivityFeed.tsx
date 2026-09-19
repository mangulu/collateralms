'use client';
import React, { useEffect, useState } from 'react';
import { FileCheck, FilePlus, AlertCircle, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { auditLogService, type AuditLogEntry } from '@/lib/supabase/auditLogService';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';
import { useDashboardRefresh } from '../DashboardRefreshContext';


const activityConfig: Record<
  string,
  { icon: React.ElementType; iconStyle: React.CSSProperties; dotClass: string }
> = {
  perfected: { icon: CheckCircle2, iconStyle: { color: 'var(--izou-success)' }, dotClass: 'bg-green-500' },
  created: { icon: FilePlus, iconStyle: { color: 'var(--izou-secondary)' }, dotClass: 'bg-blue-500' },
  overdue: { icon: AlertCircle, iconStyle: { color: 'var(--izou-danger)' }, dotClass: 'bg-red-500' },
  submitted: { icon: FileCheck, iconStyle: { color: 'var(--izou-secondary-mid)' }, dotClass: 'bg-indigo-500' },
  released: { icon: ArrowUpRight, iconStyle: { color: 'var(--izou-teal)' }, dotClass: 'bg-teal-500' },
  updated: { icon: FileCheck, iconStyle: { color: 'var(--izou-secondary)' }, dotClass: 'bg-blue-500' },
  status_changed: { icon: FileCheck, iconStyle: { color: 'var(--izou-highlight)' }, dotClass: 'bg-purple-500' },
  deleted: { icon: AlertCircle, iconStyle: { color: 'var(--izou-neutral)' }, dotClass: 'bg-gray-500' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function RecentActivityFeed() {
  const { refreshKey } = useDashboardRefresh();
  const [activities, setActivities] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = () => {
    auditLogService.getAll(undefined, 8).then((data) => {
      setActivities(data);
      setIsLoading(false);
    }).catch(() => {
      setError('Failed to load recent activity.');
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadActivities();
  }, [refreshKey]);

  useCollateralRealtime({
    onAuditChange: () => {
      auditLogService.getAll(undefined, 8).then((data) => setActivities(data)).catch(() => {});
    },
  });

  return (
    <div
      className="rounded-2xl h-full"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div
        className="px-5 py-4"
        style={{ borderBottom: '1px solid var(--izou-border)' }}
      >
        <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>Recent Activity</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>
          Audit trail — last 24 hours
        </p>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skel-${i}`} className="flex gap-3 items-start">
              <div
                className="w-7 h-7 rounded-xl animate-pulse shrink-0"
                style={{ backgroundColor: 'var(--izou-skeleton)' }}
              />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 animate-pulse rounded-lg w-3/4" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
                <div className="h-2.5 animate-pulse rounded-lg w-1/2" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
          <AlertCircle size={24} style={{ color: 'var(--izou-danger)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--izou-danger)' }}>Could not load activity</p>
          <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{error}</p>
        </div>
      ) : (
        <div style={{ borderTop: 'none' }}>
          {activities.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--izou-muted)' }}>
              No recent activity found
            </div>
          ) : (
            activities.map((activity) => {
              const config = activityConfig[activity.action] ?? activityConfig.created;
              const ActivityIcon = config.icon;
              return (
                <div
                  key={`activity-${activity.id}`}
                  className="flex items-start gap-3 px-5 py-3 transition-colors"
                  style={{ borderBottom: '1px solid var(--izou-border)' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--izou-primary-light)' }}
                  >
                    <ActivityIcon size={14} style={config.iconStyle} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug truncate" style={{ color: 'var(--izou-text)' }}>
                      {activity.message}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                      {activity.detail}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px]" style={{ color: 'var(--izou-muted)' }}>
                        {timeAgo(activity.createdAt)}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--izou-muted)' }}>·</span>
                      <span className="text-[10px]" style={{ color: 'var(--izou-muted)' }}>
                        {activity.performedByName || 'System'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}