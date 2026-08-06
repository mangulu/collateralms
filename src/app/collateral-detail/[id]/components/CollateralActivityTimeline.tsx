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
  Package,
  MapPin,
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
  isArchiveEvent?: boolean;
  archiveMeta?: {
    locationName?: string;
    locationCode?: string;
    physicalRef?: string;
  };
}

interface CollateralActivityTimelineProps {
  collateral: CollateralRecord;
}

// ─── Status icon/color helpers ────────────────────────────────────────────────

function getEventStyle(action: string, isArchiveEvent?: boolean): { icon: React.ElementType; dotColor: string; iconColor: string; bgColor?: string } {
  if (isArchiveEvent) {
    return { icon: Package, dotColor: 'bg-slate-600', iconColor: 'text-slate-600', bgColor: 'bg-slate-50 border border-slate-200 rounded-lg' };
  }
  switch (action) {
    case 'perfected': case 'status_changed':
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

      // Load standard audit events
      const { data: auditData } = await supabase
        .from('audit_logs')
        .select('id, action, message, performed_by_name, created_at')
        .eq('collateral_record_id', collateral.id)
        .in('action', ['created', 'status_changed', 'perfected', 'submitted', 'released', 'overdue', 'updated'])
        .order('created_at', { ascending: false })
        .limit(4);

      // Load archive audit events for this collateral
      const { data: archiveData } = await supabase
        .from('archive_audit_log')
        .select(`
          id, event_type, description, performed_by, created_at,
          archive_locations(name, code),
          user_profiles:performed_by(full_name)
        `)
        .eq('collateral_id', collateral.id)
        .in('event_type', ['placement_assigned', 'placement_updated', 'collateral_moved'])
        .order('created_at', { ascending: false })
        .limit(3);

      // Load placement info for archive events to get location details
      const { data: placementData } = await supabase
        .from('archive_placements')
        .select(`
          *,
          archive_locations(name, code)
        `)
        .eq('collateral_id', collateral.id)
        .maybeSingle();

      const standardEvents: StatusEvent[] = (auditData || []).map((r: any) => ({
        id: r.id,
        action: r.action,
        message: r.message,
        performedByName: r.performed_by_name ?? 'System',
        createdAt: r.created_at,
        isArchiveEvent: false,
      }));

      const archiveEvents: StatusEvent[] = (archiveData || []).map((r: any) => {
        const locationName = r.archive_locations?.name ?? placementData?.archive_locations?.name ?? null;
        const locationCode = r.archive_locations?.code ?? placementData?.archive_locations?.code ?? null;
        const physicalRef = placementData?.physical_ref ?? null;
        const actorName = r.user_profiles?.full_name ?? 'System';

        let message = r.description || 'Archived to vault';
        if (locationName) {
          const eventTypeLabel = r.event_type === 'collateral_moved' ? 'Moved to' : 'Archived to';
          message = `${eventTypeLabel} ${locationName}${locationCode ? ` · ${locationCode}` : ''}`;
          if (physicalRef) message += ` · Ref: ${physicalRef}`;
        }

        return {
          id: r.id,
          action: r.event_type,
          message,
          performedByName: actorName,
          createdAt: r.created_at,
          isArchiveEvent: true,
          archiveMeta: {
            locationName: locationName ?? undefined,
            locationCode: locationCode ?? undefined,
            physicalRef: physicalRef ?? undefined,
          },
        };
      });

      // Merge and sort by date descending, limit to 5
      const allEvents = [...standardEvents, ...archiveEvents]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      setEvents(allEvents);
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
            {events.map((event) => {
              const style = getEventStyle(event.action, event.isArchiveEvent);
              return (
                <div key={event.id} className="flex items-start gap-3 relative">
                  {/* Dot */}
                  <div className={`w-2.5 h-2.5 rounded-full ${style.dotColor} shrink-0 mt-1 z-10 ring-2 ring-white`} />

                  {/* Content */}
                  <div className={`flex-1 min-w-0 pb-1 ${event.isArchiveEvent ? 'px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg -ml-1' : ''}`}>
                    {event.isArchiveEvent && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Package size={11} className="text-slate-500 shrink-0" />
                        <span className="text-[10px] font-700 text-slate-600 uppercase tracking-wide">
                          {event.action === 'collateral_moved' ? 'Vault Transfer' : 'Archived to Vault'}
                        </span>
                      </div>
                    )}
                    <p className="text-xs font-500 text-foreground leading-snug line-clamp-2">{event.message}</p>
                    {event.isArchiveEvent && event.archiveMeta?.locationName && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin size={9} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                          {event.archiveMeta.locationName}
                          {event.archiveMeta.locationCode && ` (${event.archiveMeta.locationCode})`}
                        </span>
                      </div>
                    )}
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
