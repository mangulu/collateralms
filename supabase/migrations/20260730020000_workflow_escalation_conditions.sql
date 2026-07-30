-- Migration: Add escalation_notify_roles to workflow_steps
-- and extend escalation_action enum with new values

-- Add escalation_notify_roles column (array of role strings)
ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS escalation_notify_roles text[] NOT NULL DEFAULT '{}';

-- Extend the workflow_escalation_action enum with new values
-- (ADD VALUE is idempotent-safe via IF NOT EXISTS in Postgres 9.6+)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'hold_payment'
      AND enumtypid = 'public.workflow_escalation_action'::regtype
  ) THEN
    ALTER TYPE public.workflow_escalation_action ADD VALUE 'hold_payment';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'notify_and_hold'
      AND enumtypid = 'public.workflow_escalation_action'::regtype
  ) THEN
    ALTER TYPE public.workflow_escalation_action ADD VALUE 'notify_and_hold';
  END IF;
END;
$$;