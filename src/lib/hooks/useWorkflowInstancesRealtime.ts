'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface WorkflowInstanceChange {
  event: RealtimeEvent;
  record: any;
  oldRecord?: any;
}

interface UseWorkflowInstancesRealtimeOptions {
  /** Called when a workflow_instances row is inserted or updated */
  onInstanceChange?: (change: WorkflowInstanceChange) => void;
  /** Called when a workflow_instance_steps row changes */
  onStepChange?: (change: WorkflowInstanceChange) => void;
  /** Called when a user_tasks row is inserted (new task assignment) */
  onTaskAssigned?: (change: WorkflowInstanceChange) => void;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase real-time changes on:
 *  - workflow_instances: INSERT and UPDATE events
 *  - workflow_instance_steps: INSERT and UPDATE events
 *  - user_tasks: INSERT events (new task assignments)
 *
 * Cleans up the channel on unmount.
 */
export function useWorkflowInstancesRealtime({
  onInstanceChange,
  onStepChange,
  onTaskAssigned,
  enabled = true,
}: UseWorkflowInstancesRealtimeOptions = {}) {
  const onInstanceRef = useRef(onInstanceChange);
  const onStepRef = useRef(onStepChange);
  const onTaskRef = useRef(onTaskAssigned);

  useEffect(() => { onInstanceRef.current = onInstanceChange; }, [onInstanceChange]);
  useEffect(() => { onStepRef.current = onStepChange; }, [onStepChange]);
  useEffect(() => { onTaskRef.current = onTaskAssigned; }, [onTaskAssigned]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `workflow-instances-realtime-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_instances' },
        (payload) => {
          onInstanceRef.current?.({ event: 'INSERT', record: payload.new });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workflow_instances' },
        (payload) => {
          onInstanceRef.current?.({ event: 'UPDATE', record: payload.new, oldRecord: payload.old });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_instance_steps' },
        (payload) => {
          onStepRef.current?.({ event: 'INSERT', record: payload.new });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workflow_instance_steps' },
        (payload) => {
          onStepRef.current?.({ event: 'UPDATE', record: payload.new, oldRecord: payload.old });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_tasks' },
        (payload) => {
          onTaskRef.current?.({ event: 'INSERT', record: payload.new });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
