-- Restrict organization_members RLS to current organization context
-- Assumes get_user_organization_id() returns the active organization for the session

DO $$
BEGIN
  -- Ensure RLS is enabled on organization_members
  PERFORM 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_members';
  EXECUTE 'ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY';

  -- Drop existing permissive policies that could leak cross-org rows (if any)
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'org_members_select_policy'
  ) THEN
    EXECUTE 'DROP POLICY org_members_select_policy ON public.organization_members';
  END IF;

  -- Create a strict select policy scoped to the caller''s organizationå
  CREATE POLICY org_members_select_policy
    ON public.organization_members
    FOR SELECT
    USING (
      organization_id = public.get_user_organization_id()
    );

  -- Optionally, maintain insert/update policies if relying on organization-scoped mutations
  -- Existing policies are left intact; add/adjust as needed separately.
END $$;

COMMENT ON POLICY org_members_select_policy ON public.organization_members IS 'Restricts member visibility to the current session''s organization via get_user_organization_id().';


