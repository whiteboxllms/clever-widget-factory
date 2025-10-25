-- Remove redundant full_name column from profiles
-- Context: Names are sourced from organization_members.full_name or secure RPCs.
-- Safety: No DB triggers/functions reference profiles.full_name.

DO $$
BEGIN
  -- Drop column if it exists (safe re-run)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS full_name;
  END IF;
END $$;

-- Optional: document rationale
COMMENT ON TABLE public.profiles IS 'Global, non-org user attributes (e.g., favorite_color). Names live in organization_members.';


