'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface EscalationEvent {
  instanceId: string;
  referenceLabel: string | null;
  referenceType: string;
  workflowName?: string;
  stepName?: string;
  performedByName?: string | null;
  comment?: string | null;
  timestamp: string;
}

interface UseEscalationRealtimeOptions {
  /** Called when a workflow instance transitions to 'escalated' status */
  onEscalation?: (event: EscalationEvent) => void;
  /** Called with the latest escalated-instance count */
  onEscalatedCountChange?: (count: number) => void;
  /** Whether the subscription should be active */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase realtime on workflow_instances (status → escalated)
 * and workflow_transition_logs (action = 'escalate').
 * Fires onEscalation with enriched event data and keeps escalated count in sync.
 */
export function useEscalationRealtime({
  onEscalation,
  onEscalatedCountChange,
  enabled = true,
}: UseEscalationRealtimeOptions = {}) {
  const onEscalationRef = useRef(onEscalation);
  const onCountRef = useRef(onEscalatedCountChange);

  useEffect(() => { onEscalationRef.current = onEscalation; }, [onEscalation]);
  useEffect(() => { onCountRef.current = onEscalatedCountChange; }, [onEscalatedCountChange]);

  const fetchEscalatedCount = useCallback(async () => {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('workflow_instances')
        .select('id', { count: 'exact', head: true })
        .eq('instance_status', 'escalated');
      onCountRef.current?.(count ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `escalation-realtime-${Math.random().toString(36).slice(2)}`;

    // Initial count fetch
    fetchEscalatedCount();

    const channel = supabase
      .channel(channelName)
      // Watch workflow_instances for status changes to 'escalated'
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workflow_instances' },
        async (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          // Only fire when status just changed TO escalated
          if (newRow?.instance_status === 'escalated' && oldRow?.instance_status !== 'escalated') {
            // Fetch enriched data for the toast
            try {
              const { data: instanceRow } = await supabase
                .from('workflow_instances')
                .select('id, reference_type, reference_label, template_id')
                .eq('id', newRow.id)
                .single();

              let workflowName: string | undefined;
              if (instanceRow?.template_id) {
                const { data: tpl } = await supabase
                  .from('workflow_templates')
                  .select('name')
                  .eq('id', instanceRow.template_id)
                  .single();
                workflowName = tpl?.name;
              }

              const event: EscalationEvent = {
                instanceId: newRow.id,
                referenceLabel: instanceRow?.reference_label ?? null,
                referenceType: instanceRow?.reference_type ?? newRow.reference_type,
                workflowName,
                timestamp: new Date().toISOString(),
              };

              onEscalationRef.current?.(event);
            } catch {
              // Fire with minimal data if enrichment fails
              onEscalationRef.current?.({
                instanceId: newRow.id,
                referenceLabel: newRow.reference_label ?? null,
                referenceType: newRow.reference_type ?? '',
                timestamp: new Date().toISOString(),
              });
            }

            // Refresh count
            fetchEscalatedCount();
          }
        }
      )
      // Watch workflow_transition_logs for 'escalate' action inserts
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workflow_transition_logs' },
        async (payload) => {
          const row = payload.new as any;
          if (row?.action !== 'escalate') return;

          try {
            const { data: instanceRow } = await supabase
              .from('workflow_instances')
              .select('id, reference_type, reference_label, template_id, current_step_id')
              .eq('id', row.instance_id)
              .single();

            let workflowName: string | undefined;
            let stepName: string | undefined;

            if (instanceRow?.template_id) {
              const { data: tpl } = await supabase
                .from('workflow_templates')
                .select('name')
                .eq('id', instanceRow.template_id)
                .single();
              workflowName = tpl?.name;
            }

            if (instanceRow?.current_step_id) {
              const { data: step } = await supabase
                .from('workflow_steps')
                .select('name')
                .eq('id', instanceRow.current_step_id)
                .single();
              stepName = step?.name;
            }

            const event: EscalationEvent = {
              instanceId: row.instance_id,
              referenceLabel: instanceRow?.reference_label ?? null,
              referenceType: instanceRow?.reference_type ?? '',
              workflowName,
              stepName,
              performedByName: row.performed_by_name ?? null,
              comment: row.comment ?? null,
              timestamp: row.created_at ?? new Date().toISOString(),
            };

            onEscalationRef.current?.(event);
          } catch {
            onEscalationRef.current?.({
              instanceId: row.instance_id,
              referenceLabel: null,
              referenceType: '',
              performedByName: row.performed_by_name ?? null,
              comment: row.comment ?? null,
              timestamp: row.created_at ?? new Date().toISOString(),
            });
          }

          fetchEscalatedCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchEscalatedCount]);
}
