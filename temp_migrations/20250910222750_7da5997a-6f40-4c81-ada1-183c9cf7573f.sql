-- Remove the overly permissive policy that allows any authenticated user to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;

-- The remaining policies are secure:
-- - "Users can view their own full profile" - allows users to see only their own data
-- - "Users can insert their own profile" - allows users to create only their own profile
-- - "Users can update their own profile with role protection" - allows users to update only their own profile

-- Create a more secure policy for organization admins to view profiles within their organization
CREATE POLICY "Organization admins can view organization member profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om1.role = 'admin'
    AND om2.user_id = profiles.user_id
  )
);