-- Drop the dependent policies first, then remove the status column
DROP POLICY IF EXISTS "Users can activate their own pending membership" ON public.organization_members CASCADE;
DROP POLICY IF EXISTS "Organization admins can view pending members" ON public.organization_members CASCADE;

-- Now remove the status column
ALTER TABLE public.organization_members DROP COLUMN IF EXISTS status;