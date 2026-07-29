-- Add 'Certificate of Incorporation' to document_type enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Certificate of Incorporation'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Certificate of Incorporation';
  END IF;
END;
$$;
