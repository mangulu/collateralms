-- Legal Sign-Off for Perfected Collateral Records
-- Allows legal officers to digitally sign off on perfected collateral with timestamp, notes, and audit trail

CREATE TABLE IF NOT EXISTS public.legal_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  signed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  signed_by_name TEXT NOT NULL,
  signed_by_role TEXT NOT NULL DEFAULT 'Legal Officer',
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'signed' CHECK (status IN ('signed', 'revoked')),
  revoked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  revoked_by_name TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_signoffs_collateral_record_id ON public.legal_signoffs(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_legal_signoffs_collateral_id ON public.legal_signoffs(collateral_id);
CREATE INDEX IF NOT EXISTS idx_legal_signoffs_signed_by ON public.legal_signoffs(signed_by);
CREATE INDEX IF NOT EXISTS idx_legal_signoffs_signed_at ON public.legal_signoffs(signed_at DESC);

ALTER TABLE public.legal_signoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_legal_signoffs" ON public.legal_signoffs;
CREATE POLICY "authenticated_manage_legal_signoffs"
ON public.legal_signoffs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
