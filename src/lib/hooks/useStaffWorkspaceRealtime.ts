'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseStaffWorkspaceRealtimeOptions {
  /** Called whenever a user_tasks row is inserted (new assignment) */
  onTaskInsert?: (payload: any) => void;
  /** Called whenever a user_tasks row is updated (completion, cancellation, etc.) */
  onTaskUpdate?: (payload: any) => void;
  /** Called whenever a user_tasks row is deleted */
  onTaskDelete?: (payload: any) => void;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase real-time updates on the user_tasks table.
 * Fires callbacks for INSERT (new assignments), UPDATE (completions/cancellations),
 * and DELETE events so the Staff Workspace refreshes instantly without a page reload.
 * Cleans up the channel on unmount.
 */
export function useStaffWorkspaceRealtime({
  onTaskInsert,
  onTaskUpdate,
  onTaskDelete,
  enabled = true,
}: UseStaffWorkspaceRealtimeOptions = {}) {
  const onInsertRef = useRef(onTaskInsert);
  const onUpdateRef = useRef(onTaskUpdate);
  const onDeleteRef = useRef(onTaskDelete);

  useEffect(() => { onInsertRef.current = onTaskInsert; }, [onTaskInsert]);
  useEffect(() => { onUpdateRef.current = onTaskUpdate; }, [onTaskUpdate]);
  useEffect(() => { onDeleteRef.current = onTaskDelete; }, [onTaskDelete]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `staff-workspace-realtime-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_tasks' },
        (payload) => {
          onInsertRef.current?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_tasks' },
        (payload) => {
          onUpdateRef.current?.(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'user_tasks' },
        (payload) => {
          onDeleteRef.current?.(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
