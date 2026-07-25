'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ApprovalQueueEvent = 'INSERT' | 'UPDATE';

export interface ApprovalQueueChange {
  event: ApprovalQueueEvent;
  /** The new row data from the DB */
  record: any;
  /** The old row data (only on UPDATE) */
  oldRecord?: any;
}

interface UseApprovalQueueRealtimeOptions {
  /** Fired when a perfection_request row is inserted or updated to a pending status */
  onPerfectionChange?: (change: ApprovalQueueChange) => void;
  /** Fired when a collateral_records row status changes (release-related) */
  onCollateralStatusChange?: (change: ApprovalQueueChange) => void;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase real-time changes on the approval queue:
 *  - perfection_requests: INSERT and UPDATE events
 *  - collateral_records: UPDATE events (for release/discharge status changes)
 *
 * Cleans up the channel on unmount.
 */
export function useApprovalQueueRealtime({
  onPerfectionChange,
  onCollateralStatusChange,
  enabled = true,
}: UseApprovalQueueRealtimeOptions = {}) {
  const onPerfectionRef = useRef(onPerfectionChange);
  const onCollateralRef = useRef(onCollateralStatusChange);

  useEffect(() => { onPerfectionRef.current = onPerfectionChange; }, [onPerfectionChange]);
  useEffect(() => { onCollateralRef.current = onCollateralStatusChange; }, [onCollateralStatusChange]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `approval-queue-realtime-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'perfection_requests' },
        (payload) => {
          onPerfectionRef.current?.({
            event: 'INSERT',
            record: payload.new,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'perfection_requests' },
        (payload) => {
          onPerfectionRef.current?.({
            event: 'UPDATE',
            record: payload.new,
            oldRecord: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'collateral_records' },
        (payload) => {
          onCollateralRef.current?.({
            event: 'UPDATE',
            record: payload.new,
            oldRecord: payload.old,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
