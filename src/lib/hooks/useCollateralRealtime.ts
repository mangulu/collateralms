'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseCollateralRealtimeOptions {
  /** Called whenever a collateral_records row changes */
  onCollateralChange?: (event: RealtimeEvent, payload: any) => void;
  /** Called whenever an audit_log row is inserted */
  onAuditChange?: (event: RealtimeEvent, payload: any) => void;
  /** Called whenever an archive_placements row changes */
  onPlacementChange?: (event: RealtimeEvent, payload: any) => void;
  /** Called whenever a collateral_documents row changes */
  onDocumentChange?: (event: RealtimeEvent, payload: any) => void;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase real-time updates on collateral_records,
 * audit_log, archive_placements, and collateral_documents tables.
 * Cleans up the channel on unmount.
 */
export function useCollateralRealtime({
  onCollateralChange,
  onAuditChange,
  onPlacementChange,
  onDocumentChange,
  enabled = true,
}: UseCollateralRealtimeOptions = {}) {
  const onCollateralRef = useRef(onCollateralChange);
  const onAuditRef = useRef(onAuditChange);
  const onPlacementRef = useRef(onPlacementChange);
  const onDocumentRef = useRef(onDocumentChange);

  useEffect(() => { onCollateralRef.current = onCollateralChange; }, [onCollateralChange]);
  useEffect(() => { onAuditRef.current = onAuditChange; }, [onAuditChange]);
  useEffect(() => { onPlacementRef.current = onPlacementChange; }, [onPlacementChange]);
  useEffect(() => { onDocumentRef.current = onDocumentChange; }, [onDocumentChange]);

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archive_placements' },
        (payload) => {
          onPlacementRef.current?.(payload.eventType as RealtimeEvent, payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collateral_documents' },
        (payload) => {
          onDocumentRef.current?.(payload.eventType as RealtimeEvent, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
