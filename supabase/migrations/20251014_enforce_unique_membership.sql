-- Enforce one membership per user per organization
-- Assumption: a user can only have one membership row per org

DO $$
BEGIN
  -- Create a unique index to enforce the invariant
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'uq_org_membership_per_user'
  ) THEN
    CREATE UNIQUE INDEX uq_org_membership_per_user
      ON public.organization_members (organization_id, user_id);
  END IF;
END $$;

COMMENT ON INDEX uq_org_membership_per_user IS 'Ensures only one membership per (organization_id, user_id).';


