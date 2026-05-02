-- ============================================================
-- CollateralMS — Twilio SMS Alerts Migration
-- ============================================================

-- 1. SMS ALERTS LOG TABLE

CREATE TABLE IF NOT EXISTS public.sms_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('FRAUD_DETECTION', 'BRELA_DEADLINE', 'APPROVAL_REQUEST', 'OVERDUE_COLLATERAL')),
  message TEXT NOT NULL,
  collateral_id TEXT,
  action_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')),
  twilio_message_sid TEXT,
  error_message TEXT,
  sent_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_sms_alerts_alert_type ON public.sms_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_status ON public.sms_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_collateral_id ON public.sms_alerts(collateral_id);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_created_at ON public.sms_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_sent_by ON public.sms_alerts(sent_by);

-- 3. EXTEND notification_preferences WITH SMS COLUMNS

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_fraud_detection BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_brela_deadline BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_approval_request BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_overdue_collateral BOOLEAN NOT NULL DEFAULT false;

-- 4. UPDATED_AT TRIGGER FUNCTION

CREATE OR REPLACE FUNCTION public.update_sms_alerts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 5. ENABLE RLS

ALTER TABLE public.sms_alerts ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

DROP POLICY IF EXISTS "authenticated_manage_sms_alerts" ON public.sms_alerts;
CREATE POLICY "authenticated_manage_sms_alerts"
ON public.sms_alerts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. TRIGGER

DROP TRIGGER IF EXISTS update_sms_alerts_updated_at ON public.sms_alerts;
CREATE TRIGGER update_sms_alerts_updated_at
  BEFORE UPDATE ON public.sms_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_alerts_updated_at();
