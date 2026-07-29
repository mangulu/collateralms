-- Migration: collateral_type_required_documents
-- Adds a configurable table that maps required documents to each collateral type.
-- Admins can manage this list via Settings → Collateral Types → Required Documents.

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.collateral_type_required_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_type_name TEXT NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Unique constraint: one document name per collateral type
CREATE UNIQUE INDEX IF NOT EXISTS idx_ctrd_type_doc
  ON public.collateral_type_required_documents (collateral_type_name, document_name);

-- 3. Index for fast lookups by collateral type
CREATE INDEX IF NOT EXISTS idx_ctrd_collateral_type
  ON public.collateral_type_required_documents (collateral_type_name);

-- 4. Enable RLS
ALTER TABLE public.collateral_type_required_documents ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — all authenticated users can read; only authenticated can write
DROP POLICY IF EXISTS "ctrd_select" ON public.collateral_type_required_documents;
CREATE POLICY "ctrd_select"
  ON public.collateral_type_required_documents
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ctrd_insert" ON public.collateral_type_required_documents;
CREATE POLICY "ctrd_insert"
  ON public.collateral_type_required_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "ctrd_update" ON public.collateral_type_required_documents;
CREATE POLICY "ctrd_update"
  ON public.collateral_type_required_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "ctrd_delete" ON public.collateral_type_required_documents;
CREATE POLICY "ctrd_delete"
  ON public.collateral_type_required_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- 6. Seed default required documents (mirrors the previous hardcoded MANDATORY_DOCS map)
DO $$
BEGIN
  -- Mortgage
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('Mortgage', 'Title Deed (Original)', 1),
    ('Mortgage', 'Valuation Report (Certified)', 2),
    ('Mortgage', 'Land Rent Clearance Certificate', 3),
    ('Mortgage', 'Mortgage Deed / Charge Instrument', 4),
    ('Mortgage', 'Lands Registry Search Certificate', 5),
    ('Mortgage', 'Survey Plan / Plot Map', 6),
    ('Mortgage', 'Building Permit (if applicable)', 7)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

  -- Debenture
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('Debenture', 'Debenture Deed (Executed)', 1),
    ('Debenture', 'Certificate of Incorporation', 2),
    ('Debenture', 'Board Resolution (Authorising Charge)', 3),
    ('Debenture', 'BRELA Registration Certificate', 4),
    ('Debenture', 'Memorandum & Articles of Association', 5),
    ('Debenture', 'Audited Financial Statements (Latest)', 6),
    ('Debenture', 'Asset Schedule / Inventory List', 7)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

  -- Motor Vehicle
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('Motor Vehicle', 'Vehicle Registration Certificate (Original)', 1),
    ('Motor Vehicle', 'Logbook (Original)', 2),
    ('Motor Vehicle', 'TRA Encumbrance Search Certificate', 3),
    ('Motor Vehicle', 'Comprehensive Insurance Policy', 4),
    ('Motor Vehicle', 'Valuation Report', 5),
    ('Motor Vehicle', 'Hire Purchase / Charge Agreement', 6)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

  -- Shares (DSE)
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('Shares (DSE)', 'Share Certificate(s) (Original)', 1),
    ('Shares (DSE)', 'DSE Pledge Confirmation Letter', 2),
    ('Shares (DSE)', 'CDS Account Statement', 3),
    ('Shares (DSE)', 'Board Resolution (Authorising Pledge)', 4),
    ('Shares (DSE)', 'Share Transfer Form (Blank, Signed)', 5),
    ('Shares (DSE)', 'DSE Registry Search', 6)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

  -- FDR
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('FDR', 'Fixed Deposit Receipt (Original)', 1),
    ('FDR', 'Bank Lien Letter / Pledge Confirmation', 2),
    ('FDR', 'Account Statement', 3),
    ('FDR', 'Deed of Assignment', 4)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

  -- Guarantee
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('Guarantee', 'Guarantee Deed (Executed)', 1),
    ('Guarantee', 'Guarantor Financial Statements', 2),
    ('Guarantee', 'Board Resolution (if Corporate Guarantor)', 3),
    ('Guarantee', 'Certificate of Incorporation (if Corporate)', 4),
    ('Guarantee', 'Guarantor ID / KYC Documents', 5)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

  -- Ship/Vessel
  INSERT INTO public.collateral_type_required_documents (collateral_type_name, document_name, sort_order)
  VALUES
    ('Ship/Vessel', 'Ship Registration Certificate (TASAC)', 1),
    ('Ship/Vessel', 'Mortgage of Ship Deed', 2),
    ('Ship/Vessel', 'TASAC Encumbrance Search', 3),
    ('Ship/Vessel', 'Hull & Machinery Insurance Policy', 4),
    ('Ship/Vessel', 'Valuation / Survey Report', 5),
    ('Ship/Vessel', 'Classification Society Certificate', 6),
    ('Ship/Vessel', 'Crew & Manning Certificate', 7)
  ON CONFLICT (collateral_type_name, document_name) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
