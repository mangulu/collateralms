-- Migration: Add escalation_notify_roles to workflow_steps
-- and extend escalation_action enum with new values

-- Add escalation_notify_roles column (array of role strings)
ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS escalation_notify_roles text[] NOT NULL DEFAULT '{}';

-- Extend escalation_action check constraint to include new actions
-- First drop the existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_steps_escalation_action_check'
  ) THEN
    ALTER TABLE workflow_steps DROP CONSTRAINT workflow_steps_escalation_action_check;
  END IF;
END;
$$;

-- Re-add with extended values
ALTER TABLE workflow_steps
  ADD CONSTRAINT workflow_steps_escalation_action_check
  CHECK (escalation_action IN (
    'notify_manager',
    'reassign',
    'auto_approve',
    'auto_reject',
    'escalate_to_role',
    'hold_payment',
    'notify_and_hold'
  ));
