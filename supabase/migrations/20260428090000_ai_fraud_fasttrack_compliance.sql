-- Migration: New feature tables for AI Fraud Prevention, Fast Track, and Compliance Rules
-- Timestamp: 20260428090000

-- ─── fraud_alerts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collateral_id UUID REFERENCES public.collateral(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL, -- DUPLICATE_TITLE, IDENTITY_MISMATCH, VALUATION_ANOMALY, DOCUMENT_FORGERY, EARLY_WARNING
    risk_score DECIMAL(5,2),         -- 0-100
    confidence DECIMAL(5,2),
    severity VARCHAR(10) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    details JSONB,
    status VARCHAR(20) DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, FALSE_POSITIVE, ESCALATED, RESOLVED
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_collateral_id ON public.fraud_alerts(collateral_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_alert_type ON public.fraud_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created_at ON public.fraud_alerts(created_at DESC);

-- ─── customer_tier ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_tier (
    customer_id VARCHAR(50) PRIMARY KEY,
    tier VARCHAR(20) DEFAULT 'STANDARD', -- PREMIER, REPEAT, STANDARD
    tier_effective_date DATE,
    tier_expiry_date DATE,
    reason VARCHAR(200),
    updated_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_tier_tier ON public.customer_tier(tier);

-- ─── compliance_rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50), -- LTV, DEADLINE, ELIGIBILITY
    condition JSONB NOT NULL, -- e.g., {"field": "ltv_ratio", "operator": ">", "value": 0.70}
    action VARCHAR(10), -- BLOCK, WARN, LOG
    message TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_count INTEGER DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_rule_type ON public.compliance_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_is_active ON public.compliance_rules(is_active);

-- ─── collateral location columns (PostGIS-ready) ──────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'collateral' AND column_name = 'address_verified'
    ) THEN
        ALTER TABLE public.collateral ADD COLUMN address_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'collateral' AND column_name = 'risk_zone'
    ) THEN
        ALTER TABLE public.collateral ADD COLUMN risk_zone VARCHAR(10); -- LOW, MEDIUM, HIGH
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'collateral' AND column_name = 'latitude'
    ) THEN
        ALTER TABLE public.collateral ADD COLUMN latitude DECIMAL(10,7);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'collateral' AND column_name = 'longitude'
    ) THEN
        ALTER TABLE public.collateral ADD COLUMN longitude DECIMAL(10,7);
    END IF;
END $$;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fraud_alerts' AND policyname = 'fraud_alerts_authenticated_read'
    ) THEN
        CREATE POLICY fraud_alerts_authenticated_read ON public.fraud_alerts
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fraud_alerts' AND policyname = 'fraud_alerts_authenticated_write'
    ) THEN
        CREATE POLICY fraud_alerts_authenticated_write ON public.fraud_alerts
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_tier' AND policyname = 'customer_tier_authenticated_read'
    ) THEN
        CREATE POLICY customer_tier_authenticated_read ON public.customer_tier
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_tier' AND policyname = 'customer_tier_authenticated_write'
    ) THEN
        CREATE POLICY customer_tier_authenticated_write ON public.customer_tier
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_rules' AND policyname = 'compliance_rules_authenticated_read'
    ) THEN
        CREATE POLICY compliance_rules_authenticated_read ON public.compliance_rules
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'compliance_rules' AND policyname = 'compliance_rules_authenticated_write'
    ) THEN
        CREATE POLICY compliance_rules_authenticated_write ON public.compliance_rules
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ─── Seed default compliance rules ───────────────────────────────────────────

INSERT INTO public.compliance_rules (rule_name, rule_type, condition, action, message, is_active)
SELECT 'LTV Supervisor Approval', 'LTV', '{"field":"ltv_ratio","operator":">","value":0.70}'::jsonb, 'BLOCK', 'LTV exceeds 70% limit. Supervisor approval required before proceeding.', true
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_rules WHERE rule_name = 'LTV Supervisor Approval');

INSERT INTO public.compliance_rules (rule_name, rule_type, condition, action, message, is_active)
SELECT 'BRELA 42-Day Deadline Warning', 'DEADLINE', '{"field":"days_to_brela_deadline","operator":"<=","value":7}'::jsonb, 'WARN', 'BRELA submission deadline is within 7 days. Immediate action required.', true
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_rules WHERE rule_name = 'BRELA 42-Day Deadline Warning');

INSERT INTO public.compliance_rules (rule_name, rule_type, condition, action, message, is_active)
SELECT 'Maximum LTV Hard Cap', 'LTV', '{"field":"ltv_ratio","operator":">","value":0.85}'::jsonb, 'BLOCK', 'LTV exceeds absolute maximum of 85%. Loan cannot proceed.', false
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_rules WHERE rule_name = 'Maximum LTV Hard Cap');
