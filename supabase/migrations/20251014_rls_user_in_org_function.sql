-- Helper function to check if current auth user is a member of a given org
-- Avoids recursive RLS by running as SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.user_in_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND COALESCE(m.is_active, true) = true
      AND m.organization_id = target_org_id
  );
$$;

COMMENT ON FUNCTION public.user_in_org(uuid) IS 'Returns true if auth.uid() has an active membership in the specified organization.';

-- Recreate SELECT policy to use the helper function (no self-referential recursion)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'org_members_select_policy'
  ) THEN
    EXECUTE 'DROP POLICY org_members_select_policy ON public.organization_members';
  END IF;

  EXECUTE 'CREATE POLICY org_members_select_policy ON public.organization_members FOR SELECT USING (public.user_in_org(organization_id));';
END $$;


