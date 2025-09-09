-- Remove the status column from organization_members table
ALTER TABLE public.organization_members DROP COLUMN IF EXISTS status;

-- Drop the status-related RLS policies
DROP POLICY IF EXISTS "Users can activate their own pending membership" ON public.organization_members;
DROP POLICY IF EXISTS "Organization admins can view pending members" ON public.organization_members;