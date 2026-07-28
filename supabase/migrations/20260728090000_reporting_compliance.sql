-- ─── Reporting & Compliance: Scheduled Reports, Regulatory Tracking, LTV Breach Alerts ──

-- ─── 1. Scheduled Report Recipients ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_report_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type       TEXT NOT NULL,
  -- 'weekly_perfection_summary' | 'monthly_portfolio_review'
  report_label      TEXT NOT NULL,
  is_enabled        BOOLEAN NOT NULL DEFAULT true,
  schedule_cron     TEXT NOT NULL DEFAULT '0 8 * * 1',
  -- weekly Monday 8am by default
  recipients        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{name, email, role}]
  last_sent_at      TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  created_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_report_configs_type
  ON public.scheduled_report_configs (report_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_configs_enabled
  ON public.scheduled_report_configs (is_enabled);

-- ─── 2. Scheduled Report Delivery Log ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_report_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID REFERENCES public.scheduled_report_configs(id) ON DELETE CASCADE,
  report_type     TEXT NOT NULL,
  report_label    TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipients      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'sent',
  -- 'sent' | 'failed' | 'partial'
  error_message   TEXT,
  report_summary  JSONB,
  -- snapshot of key metrics at time of send
  triggered_by    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_deliveries_config
  ON public.scheduled_report_deliveries (config_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_deliveries_sent_at
  ON public.scheduled_report_deliveries (sent_at DESC);

-- ─── 3. Regulatory Submission Tracking ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.regulatory_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name         TEXT NOT NULL,
  report_type         TEXT NOT NULL,
  -- 'BOT' | 'BRELA' | 'Internal' | 'Other'
  regulatory_body     TEXT NOT NULL DEFAULT 'BOT',
  reporting_period    TEXT NOT NULL,
  -- e.g. 'Q1 2026', 'June 2026'
  generated_at        TIMESTAMPTZ,
  generated_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_at        TIMESTAMPTZ,
  submitted_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submission_ref      TEXT,
  -- reference number from regulator
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  acknowledgement_ref TEXT,
  submission_status   TEXT NOT NULL DEFAULT 'Pending Generation',
  -- 'Pending Generation' | 'Generated' | 'Submitted' | 'Acknowledged' | 'Overdue'
  due_date            DATE,
  notes               TEXT,
  attachments         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_submissions_status
  ON public.regulatory_submissions (submission_status);

CREATE INDEX IF NOT EXISTS idx_regulatory_submissions_due_date
  ON public.regulatory_submissions (due_date);

CREATE INDEX IF NOT EXISTS idx_regulatory_submissions_report_type
  ON public.regulatory_submissions (report_type);

-- ─── 4. LTV Breach Alerts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ltv_breach_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id       UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  loan_id             UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  alert_type          TEXT NOT NULL DEFAULT 'LTV_BREACH',
  covenant_threshold  NUMERIC(10,4) NOT NULL,
  -- e.g. 0.75 = 75%
  current_ltv         NUMERIC(10,4) NOT NULL,
  collateral_value    NUMERIC(18,2) NOT NULL,
  loan_exposure       NUMERIC(18,2) NOT NULL,
  breach_amount       NUMERIC(18,2),
  -- how much value needs to be added to cure
  severity            TEXT NOT NULL DEFAULT 'High',
  -- 'Critical' | 'High' | 'Medium'
  alert_status        TEXT NOT NULL DEFAULT 'Open',
  -- 'Open' | 'Acknowledged' | 'Resolved' | 'Waived'
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  resolved_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolution_notes    TEXT,
  sms_sent            BOOLEAN NOT NULL DEFAULT false,
  email_sent          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ltv_breach_alerts_collateral
  ON public.ltv_breach_alerts (collateral_id);

CREATE INDEX IF NOT EXISTS idx_ltv_breach_alerts_loan
  ON public.ltv_breach_alerts (loan_id);

CREATE INDEX IF NOT EXISTS idx_ltv_breach_alerts_status
  ON public.ltv_breach_alerts (alert_status);

CREATE INDEX IF NOT EXISTS idx_ltv_breach_alerts_triggered
  ON public.ltv_breach_alerts (triggered_at DESC);

-- ─── 5. LTV Breach Alert Thresholds Config ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ltv_alert_thresholds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_type     TEXT NOT NULL DEFAULT 'All',
  -- 'All' | specific type
  warning_threshold   NUMERIC(5,4) NOT NULL DEFAULT 0.70,
  -- 70% LTV triggers warning
  critical_threshold  NUMERIC(5,4) NOT NULL DEFAULT 0.80,
  -- 80% LTV triggers critical
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  notify_officer      BOOLEAN NOT NULL DEFAULT true,
  notify_email        BOOLEAN NOT NULL DEFAULT true,
  notify_sms          BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ltv_alert_thresholds_type
  ON public.ltv_alert_thresholds (collateral_type);

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.scheduled_report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_report_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ltv_breach_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ltv_alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_report_configs_authenticated" ON public.scheduled_report_configs;
CREATE POLICY "scheduled_report_configs_authenticated"
  ON public.scheduled_report_configs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "scheduled_report_deliveries_authenticated" ON public.scheduled_report_deliveries;
CREATE POLICY "scheduled_report_deliveries_authenticated"
  ON public.scheduled_report_deliveries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "regulatory_submissions_authenticated" ON public.regulatory_submissions;
CREATE POLICY "regulatory_submissions_authenticated"
  ON public.regulatory_submissions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ltv_breach_alerts_authenticated" ON public.ltv_breach_alerts;
CREATE POLICY "ltv_breach_alerts_authenticated"
  ON public.ltv_breach_alerts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ltv_alert_thresholds_authenticated" ON public.ltv_alert_thresholds;
CREATE POLICY "ltv_alert_thresholds_authenticated"
  ON public.ltv_alert_thresholds FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── 7. Seed Default Data ────────────────────────────────────────────────────

DO $$
BEGIN
  -- Default scheduled report configs
  INSERT INTO public.scheduled_report_configs (report_type, report_label, schedule_cron, is_enabled, recipients)
  VALUES
    ('weekly_perfection_summary', 'Weekly Perfection Summary', '0 8 * * 1', true, '[]'::jsonb),
    ('monthly_portfolio_review',  'Monthly Portfolio Review',  '0 8 1 * *', true, '[]'::jsonb)
  ON CONFLICT (report_type) DO NOTHING;

  -- Default LTV threshold (All collateral types)
  INSERT INTO public.ltv_alert_thresholds (collateral_type, warning_threshold, critical_threshold, is_enabled)
  VALUES ('All', 0.70, 0.80, true)
  ON CONFLICT (collateral_type) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;

-- ─── 8. Seed Sample Regulatory Submissions ───────────────────────────────────

DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    INSERT INTO public.regulatory_submissions
      (report_name, report_type, regulatory_body, reporting_period, submission_status, due_date, generated_at, generated_by, created_by)
    VALUES
      ('BOT Collateral Coverage Report Q2 2026', 'Quarterly Coverage', 'BOT', 'Q2 2026', 'Generated', '2026-07-31', now() - interval '5 days', existing_user_id, existing_user_id),
      ('BRELA Registration Compliance Report', 'Registration Compliance', 'BRELA', 'June 2026', 'Submitted', '2026-07-15', now() - interval '20 days', existing_user_id, existing_user_id),
      ('Internal Portfolio Risk Report Q2 2026', 'Portfolio Risk', 'Internal', 'Q2 2026', 'Acknowledged', '2026-07-10', now() - interval '25 days', existing_user_id, existing_user_id),
      ('BOT Monthly Collateral Return June 2026', 'Monthly Return', 'BOT', 'June 2026', 'Pending Generation', '2026-07-31', null, null, existing_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Regulatory submissions seed failed: %', SQLERRM;
END $$;
