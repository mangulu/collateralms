'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseCollateralRealtimeOptions {
  /** Called whenever a collateral_records row changes */
  onCollateralChange?: (event: RealtimeEvent, payload: any) => void;
  /** Called whenever an audit_log row is inserted */
  onAuditChange?: (event: RealtimeEvent, payload: any) => void;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase real-time updates on collateral_records and
 * (optionally) audit_log tables. Cleans up the channel on unmount.
 *
 * Usage:
 *   useCollateralRealtime({
 *     onCollateralChange: () => refetch(),
 *     onAuditChange: () => refetchAudit(),
 *   });
 */
export function useCollateralRealtime({
  onCollateralChange,
  onAuditChange,
  enabled = true,
}: UseCollateralRealtimeOptions = {}) {
  // Keep stable refs so the effect doesn't re-run when callbacks change identity
  const onCollateralRef = useRef(onCollateralChange);
  const onAuditRef = useRef(onAuditChange);

  useEffect(() => {
    onCollateralRef.current = onCollateralChange;
  }, [onCollateralChange]);

  useEffect(() => {
    onAuditRef.current = onAuditChange;
  }, [onAuditChange]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `collateral-realtime-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collateral_records' },
        (payload) => {
          onCollateralRef.current?.(payload.eventType as RealtimeEvent, payload);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_log' },
        (payload) => {
          onAuditRef.current?.('INSERT', payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
