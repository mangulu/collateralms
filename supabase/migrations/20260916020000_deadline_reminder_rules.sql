-- ============================================================
-- Deadline Reminder Rules
-- Deadline Reminders previously stored its rules in browser
-- localStorage (per-device, lost on cache clear, invisible to other
-- officers). This table gives the rules a real, shared home so any
-- officer sees and manages the same rule set.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deadline_reminder_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  days_before_deadline  INTEGER NOT NULL,
  alert_type            TEXT NOT NULL DEFAULT 'BRELA_DEADLINE',
  recipient_role        TEXT NOT NULL DEFAULT 'credit_officer',
  message_template      TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  last_run_at           TIMESTAMPTZ,
  sent_count            INTEGER NOT NULL DEFAULT 0,
  created_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deadline_reminder_rules_active
  ON public.deadline_reminder_rules(is_active);

ALTER TABLE public.deadline_reminder_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_deadline_reminder_rules" ON public.deadline_reminder_rules;
CREATE POLICY "auth_users_deadline_reminder_rules"
ON public.deadline_reminder_rules
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Seed the previous hard-coded defaults, once, on a fresh table only.
INSERT INTO public.deadline_reminder_rules
  (name, days_before_deadline, alert_type, recipient_role, message_template)
SELECT * FROM (VALUES
  ('14-Day Advance Warning', 14, 'BRELA_DEADLINE', 'credit_officer',
   'Collateral {collateralId} perfection deadline is in 14 days. Please review and take action.'),
  ('7-Day Critical Alert', 7, 'BRELA_DEADLINE', 'credit_officer',
   'URGENT: Collateral {collateralId} perfection deadline is in 7 days. Immediate action required.'),
  ('3-Day Final Notice', 3, 'OVERDUE_COLLATERAL', 'legal_officer',
   'FINAL NOTICE: Collateral {collateralId} perfection deadline is in 3 days. Legal review needed.'),
  ('Overdue Escalation', -1, 'OVERDUE_COLLATERAL', 'system_admin',
   'ESCALATION: Collateral {collateralId} perfection deadline has passed. Escalation required.')
) AS defaults(name, days_before_deadline, alert_type, recipient_role, message_template)
WHERE NOT EXISTS (SELECT 1 FROM public.deadline_reminder_rules);
