'use client';
import React, { useState, useEffect } from 'react';
import { ChevronRight, Package, Grid3X3, Clock } from 'lucide-react';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';
import StatusBadge from '@/components/ui/StatusBadge';
import { ArchiveLocation } from '@/lib/supabase/archiveService';
import { archiveReconciliationService } from '@/lib/supabase/archiveReconciliationService';

const TYPE_LABELS: Record<string, string> = { room: 'Room', cabinet: 'Cabinet', slot: 'Slot' };

interface LocationDetailDrawerProps {
  stack: ArchiveLocation[];
  onClose: () => void;
  onDrillInto: (child: ArchiveLocation) => void;
  onBreadcrumbClick: (index: number) => void;
  onSlotClick: (slot: ArchiveLocation) => void;
}

export default function LocationDetailDrawer({ stack, onClose, onDrillInto, onBreadcrumbClick, onSlotClick }: LocationDetailDrawerProps) {
  const current = stack[stack.length - 1] ?? null;
  const [lastReconciledAt, setLastReconciledAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!current) { setLastReconciledAt(undefined); return; }
    setLastReconciledAt(undefined);
    archiveReconciliationService.getLastCompletedForLocation(current.id)
      .then((session) => setLastReconciledAt(session?.completedAt ?? null))
      .catch(() => setLastReconciledAt(null));
  }, [current?.id]);

  if (!current) {
    return <WorkflowDrawer open={false} onClose={onClose}>{null}</WorkflowDrawer>;
  }

  const occupancyPct = current.capacity > 0 ? Math.round((current.currentOccupancy / current.capacity) * 100) : 0;
  const children = current.children ?? [];
  const childKind = current.locationType === 'room' ? 'cabinet' : 'slot';

  return (
    <WorkflowDrawer open={stack.length > 0} onClose={onClose} title={current.name} subtitle={current.code}>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Breadcrumb */}
          {stack.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap text-xs">
              {stack.map((loc, i) => (
                <React.Fragment key={loc.id}>
                  {i > 0 && <ChevronRight size={11} className="text-gray-400" />}
                  <button
                    onClick={() => onBreadcrumbClick(i)}
                    disabled={i === stack.length - 1}
                    className={i === stack.length - 1 ? 'font-semibold text-gray-900' : 'text-blue-600 hover:underline'}
                  >
                    {loc.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)' }}>
            <div className="flex items-center justify-between">
              <StatusBadge label={TYPE_LABELS[current.locationType] ?? current.locationType} bg="var(--izou-secondary-light)" text="var(--izou-secondary)" />
              <span className="text-xs font-bold" style={{ color: 'var(--izou-secondary)' }}>{current.currentOccupancy}/{current.capacity}</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--izou-border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(occupancyPct, 100)}%`, backgroundColor: 'var(--izou-secondary)' }} />
            </div>
            {current.description && (
              <p className="text-xs text-gray-600">{current.description}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={12} />
              {lastReconciledAt === undefined ? 'Checking reconciliation…' : lastReconciledAt
                ? `Last reconciled ${new Date(lastReconciledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : 'Never reconciled'}
            </div>
          </div>

          {/* Contents */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Contents ({children.length} {childKind}{children.length !== 1 ? 's' : ''})
            </h3>
            {children.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No {childKind}s here yet.</p>
            ) : (
              <div className="space-y-1.5">
                {children.map((child) => {
                  const pct = child.capacity > 0 ? Math.round((child.currentOccupancy / child.capacity) * 100) : 0;
                  return (
                    <button
                      key={child.id}
                      onClick={() => (childKind === 'slot' ? onSlotClick(child) : onDrillInto(child))}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-blue-50"
                      style={{ border: '1px solid var(--izou-border)' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-secondary-light)' }}>
                        {childKind === 'slot' ? <Package size={14} style={{ color: 'var(--izou-secondary-mid)' }} /> : <Grid3X3 size={14} style={{ color: 'var(--izou-warning)' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900">{child.name}</p>
                        <p className="text-xs text-gray-500">{child.code} · {child.currentOccupancy}/{child.capacity} {childKind === 'slot' ? 'items' : 'slots'}</p>
                      </div>
                      <span className="text-xs font-semibold shrink-0" style={{ color: pct >= 90 ? 'var(--izou-danger)' : 'var(--izou-muted)' }}>{pct}%</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </WorkflowDrawer>
  );
}
