-- Add status column to organization_members table
ALTER TABLE public.organization_members 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add check constraint to ensure valid status values
ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_status_check 
CHECK (status IN ('pending', 'active', 'inactive'));

-- Add RLS policy to allow organization admins to view pending members
CREATE POLICY "Organization admins can view pending members" 
ON public.organization_members 
FOR SELECT 
USING (
  (organization_id = get_user_organization_id()) 
  AND is_organization_admin()
);

-- Add RLS policy to allow users to update their own pending status to active
CREATE POLICY "Users can activate their own pending membership" 
ON public.organization_members 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  AND status = 'pending'
) 
WITH CHECK (
  user_id = auth.uid() 
  AND status = 'active'
);