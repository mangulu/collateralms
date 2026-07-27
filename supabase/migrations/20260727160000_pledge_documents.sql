-- ─── Pledge Documents Module ──────────────────────────────────────────────────
-- Stores collateral pledge documents (deeds, valuations, insurance certificates)
-- with expiry tracking and audit access logs.

-- 1. Pledge Documents Table
CREATE TABLE IF NOT EXISTS public.pledge_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligor_id        UUID NOT NULL REFERENCES public.obligors(id) ON DELETE CASCADE,
  collateral_id     UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  document_type     TEXT NOT NULL CHECK (document_type IN (
                      'Title Deed', 'Valuation Report', 'Insurance Certificate',
                      'Charge Certificate', 'Board Resolution', 'Mortgage Deed',
                      'Pledge Agreement', 'Other'
                    )),
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  file_size         BIGINT NOT NULL DEFAULT 0,
  mime_type         TEXT NOT NULL DEFAULT 'application/octet-stream',
  notes             TEXT,
  expiry_date       DATE,
  issued_date       DATE,
  issuer            TEXT,
  reference_number  TEXT,
  uploaded_by       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_by_name  TEXT NOT NULL DEFAULT 'System',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Pledge Document Access Audit Log
CREATE TABLE IF NOT EXISTS public.pledge_document_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES public.pledge_documents(id) ON DELETE CASCADE,
  obligor_id      UUID NOT NULL REFERENCES public.obligors(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('uploaded', 'viewed', 'downloaded', 'deleted', 'expiry_updated')),
  performed_by    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT NOT NULL DEFAULT 'System',
  ip_address      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_pledge_docs_obligor_id   ON public.pledge_documents(obligor_id);
CREATE INDEX IF NOT EXISTS idx_pledge_docs_collateral_id ON public.pledge_documents(collateral_id);
CREATE INDEX IF NOT EXISTS idx_pledge_docs_expiry_date  ON public.pledge_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pledge_docs_doc_type     ON public.pledge_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_pledge_access_doc_id     ON public.pledge_document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_pledge_access_obligor_id ON public.pledge_document_access_log(obligor_id);
CREATE INDEX IF NOT EXISTS idx_pledge_access_created_at ON public.pledge_document_access_log(created_at DESC);

-- 4. updated_at trigger function (reuse or create)
CREATE OR REPLACE FUNCTION public.set_pledge_docs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pledge_docs_updated_at ON public.pledge_documents;
CREATE TRIGGER trg_pledge_docs_updated_at
  BEFORE UPDATE ON public.pledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_pledge_docs_updated_at();

-- 5. Enable RLS
ALTER TABLE public.pledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledge_document_access_log ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies — pledge_documents
DROP POLICY IF EXISTS "pledge_docs_authenticated_all" ON public.pledge_documents;
CREATE POLICY "pledge_docs_authenticated_all"
  ON public.pledge_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. RLS Policies — pledge_document_access_log
DROP POLICY IF EXISTS "pledge_access_log_authenticated_all" ON public.pledge_document_access_log;
CREATE POLICY "pledge_access_log_authenticated_all"
  ON public.pledge_document_access_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
