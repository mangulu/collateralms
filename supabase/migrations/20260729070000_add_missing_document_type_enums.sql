-- Add missing document_type enum values that exist in document_type_settings but not in the enum
-- Fixes: invalid input value for enum document_type: "Mortgage Deed" (and other missing types)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Mortgage Deed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Mortgage Deed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Share Certificate'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Share Certificate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Vessel Registration'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Vessel Registration';
  END IF;
END $$;
