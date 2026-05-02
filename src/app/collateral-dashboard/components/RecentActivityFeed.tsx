'use client';
import React, { useEffect, useState } from 'react';
import { FileCheck, FilePlus, AlertCircle, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { auditService, AuditLog } from '@/lib/supabase/collateralService';
import Icon from '@/components/ui/AppIcon';


const activityConfig: Record<
  string,
  { icon: React.ElementType; iconClass: string; dotClass: string }
> = {
  perfected: { icon: CheckCircle2, iconClass: 'text-green-600', dotClass: 'bg-green-500' },
  created: { icon: FilePlus, iconClass: 'text-blue-600', dotClass: 'bg-blue-500' },
  overdue: { icon: AlertCircle, iconClass: 'text-red-600', dotClass: 'bg-red-500' },
  submitted: { icon: FileCheck, iconClass: 'text-indigo-600', dotClass: 'bg-indigo-500' },
  released: { icon: ArrowUpRight, iconClass: 'text-teal-600', dotClass: 'bg-teal-500' },
  updated: { icon: FileCheck, iconClass: 'text-blue-600', dotClass: 'bg-blue-500' },
  status_changed: { icon: FileCheck, iconClass: 'text-purple-600', dotClass: 'bg-purple-500' },
  deleted: { icon: AlertCircle, iconClass: 'text-gray-600', dotClass: 'bg-gray-500' },
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
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auditService.getRecent(8).then((data) => {
      setActivities(data);
      setIsLoading(false);
    }).catch(() => {
      setError('Failed to load recent activity.');
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-card border border-border h-full">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-base font-600 text-foreground">Recent Activity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audit trail — last 24 hours
        </p>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skel-${i}`} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-2.5 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm font-500 text-red-600">Could not load activity</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activities.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No recent activity found
            </div>
          ) : (
            activities.map((activity) => {
              const config = activityConfig[activity.action] ?? activityConfig.created;
              const Icon = config.icon;
              return (
                <div
                  key={`activity-${activity.id}`}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className={config.iconClass} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-500 text-foreground leading-snug truncate">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {activity.detail}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(activity.createdAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
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