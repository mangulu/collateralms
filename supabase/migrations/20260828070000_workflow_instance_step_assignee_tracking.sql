-- Migration: Add assigned_at column to workflow_instance_steps
-- Tracks when a step was assigned (or reassigned) to a role/user

ALTER TABLE public.workflow_instance_steps
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: for existing active steps, set assigned_at = started_at
UPDATE public.workflow_instance_steps
SET assigned_at = started_at
WHERE assigned_at IS NULL AND started_at IS NOT NULL;
