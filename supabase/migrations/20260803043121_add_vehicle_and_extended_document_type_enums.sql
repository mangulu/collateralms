-- Add missing document_type enum values for Motor Vehicle, Debenture, Shares (DSE),
-- FDR, Guarantee, Ship/Vessel, and Mortgage collateral types.
-- Fixes: invalid input value for enum document_type: "Vehicle Registration Certificate (Original)"
DO $$
BEGIN
  -- Motor Vehicle document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Vehicle Registration Certificate (Original)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Vehicle Registration Certificate (Original)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Logbook (Original)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Logbook (Original)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'TRA Encumbrance Search Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'TRA Encumbrance Search Certificate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Comprehensive Insurance Policy'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Comprehensive Insurance Policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Hire Purchase / Charge Agreement'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Hire Purchase / Charge Agreement';
  END IF;

  -- Mortgage document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Title Deed (Original)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Title Deed (Original)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Valuation Report (Certified)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Valuation Report (Certified)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Land Rent Clearance Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Land Rent Clearance Certificate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Mortgage Deed / Charge Instrument'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Mortgage Deed / Charge Instrument';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Lands Registry Search Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Lands Registry Search Certificate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Survey Plan / Plot Map'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Survey Plan / Plot Map';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Building Permit (if applicable)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Building Permit (if applicable)';
  END IF;

  -- Debenture document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Debenture Deed (Executed)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Debenture Deed (Executed)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Certificate of Incorporation'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Certificate of Incorporation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Board Resolution (Authorising Charge)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Board Resolution (Authorising Charge)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BRELA Registration Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'BRELA Registration Certificate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Memorandum & Articles of Association'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Memorandum & Articles of Association';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Audited Financial Statements (Latest)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Audited Financial Statements (Latest)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Asset Schedule / Inventory List'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Asset Schedule / Inventory List';
  END IF;

  -- Shares (DSE) document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Share Certificate(s) (Original)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Share Certificate(s) (Original)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DSE Pledge Confirmation Letter'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'DSE Pledge Confirmation Letter';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CDS Account Statement'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'CDS Account Statement';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Board Resolution (Authorising Pledge)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Board Resolution (Authorising Pledge)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Share Transfer Form (Blank, Signed)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Share Transfer Form (Blank, Signed)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DSE Registry Search'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'DSE Registry Search';
  END IF;

  -- FDR document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Fixed Deposit Receipt (Original)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Fixed Deposit Receipt (Original)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Bank Lien Letter / Pledge Confirmation'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Bank Lien Letter / Pledge Confirmation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Account Statement'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Account Statement';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Deed of Assignment'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Deed of Assignment';
  END IF;

  -- Guarantee document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Guarantee Deed (Executed)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Guarantee Deed (Executed)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Guarantor Financial Statements'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Guarantor Financial Statements';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Board Resolution (if Corporate Guarantor)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Board Resolution (if Corporate Guarantor)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Certificate of Incorporation (if Corporate)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Certificate of Incorporation (if Corporate)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Guarantor ID / KYC Documents'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Guarantor ID / KYC Documents';
  END IF;

  -- Ship/Vessel document types
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Ship Registration Certificate (TASAC)'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Ship Registration Certificate (TASAC)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Mortgage of Ship Deed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Mortgage of Ship Deed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'TASAC Encumbrance Search'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'TASAC Encumbrance Search';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Hull & Machinery Insurance Policy'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Hull & Machinery Insurance Policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Valuation / Survey Report'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Valuation / Survey Report';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Classification Society Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Classification Society Certificate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Crew & Manning Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Crew & Manning Certificate';
  END IF;

END $$;
