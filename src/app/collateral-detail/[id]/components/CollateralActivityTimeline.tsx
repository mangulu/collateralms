'use client';
import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CollateralRecord } from '@/lib/supabase/collateralService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusEvent {
  id: string;
  action: string;
  message: string;
  performedByName: string;
  createdAt: string;
}

interface CollateralActivityTimelineProps {
  collateral: CollateralRecord;
}

// ─── Status icon/color helpers ────────────────────────────────────────────────

function getEventStyle(action: string): { icon: React.ElementType; dotColor: string; iconColor: string } {
  switch (action) {
    case 'perfected': case'status_changed':
      return { icon: CheckCircle2, dotColor: 'bg-emerald-500', iconColor: 'text-emerald-600' };
    case 'submitted':
      return { icon: ArrowRight, dotColor: 'bg-blue-500', iconColor: 'text-blue-600' };
    case 'released':
      return { icon: CheckCircle2, dotColor: 'bg-purple-500', iconColor: 'text-purple-600' };
    case 'overdue':
      return { icon: AlertTriangle, dotColor: 'bg-red-500', iconColor: 'text-red-600' };
    case 'created':
      return { icon: Activity, dotColor: 'bg-primary', iconColor: 'text-primary' };
    default:
      return { icon: Clock, dotColor: 'bg-muted-foreground', iconColor: 'text-muted-foreground' };
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CollateralActivityTimeline({ collateral }: CollateralActivityTimelineProps) {
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, message, performed_by_name, created_at')
        .eq('collateral_record_id', collateral.id)
        .in('action', ['created', 'status_changed', 'perfected', 'submitted', 'released', 'overdue', 'updated'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setEvents(
          data.map((r: any) => ({
            id: r.id,
            action: r.action,
            message: r.message,
            performedByName: r.performed_by_name ?? 'System',
            createdAt: r.created_at,
          }))
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [collateral.id]);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-700 text-foreground uppercase tracking-wider">Activity</h3>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-muted mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2.5 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Activity size={16} className="text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground text-center">No activity recorded yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {events.map((event, idx) => {
              const style = getEventStyle(event.action);
              const EventIcon = style.icon;
              return (
                <div key={event.id} className="flex items-start gap-3 relative">
                  {/* Dot */}
                  <div className={`w-2.5 h-2.5 rounded-full ${style.dotColor} shrink-0 mt-1 z-10 ring-2 ring-white`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-xs font-500 text-foreground leading-snug line-clamp-2">{event.message}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User size={9} />
                        <span className="truncate max-w-[100px]">{event.performedByName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="text-[10px] text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer link */}
      {events.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <a
            href={`/audit-trail?collateral=${collateral.collateralId}`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View full audit trail
            <ArrowRight size={11} />
          </a>
        </div>
      )}
    </div>
  );
}
