-- Remove organization_id column from action_implementation_updates and rely on RLS
-- This simplifies the table structure and uses RLS for organization filtering

-- Drop the existing policies
DROP POLICY IF EXISTS "Authenticated users can view implementation updates" ON public.action_implementation_updates;
DROP POLICY IF EXISTS "Authenticated users can create implementation updates" ON public.action_implementation_updates;

-- Drop the trigger that auto-populates organization_id
DROP TRIGGER IF EXISTS trigger_set_organization_id_implementation_updates ON public.action_implementation_updates;

-- Drop the function that auto-populates organization_id
DROP FUNCTION IF EXISTS set_organization_id_for_implementation_updates();

-- Remove the organization_id column
ALTER TABLE public.action_implementation_updates DROP COLUMN IF EXISTS organization_id;

-- Create new RLS policies that use get_user_organization_id()
CREATE POLICY "Users can view implementation updates for actions in their organization" 
ON public.action_implementation_updates 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND action_id IN (
    SELECT id FROM public.actions 
    WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can create implementation updates for actions in their organization" 
ON public.action_implementation_updates 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND action_id IN (
    SELECT id FROM public.actions 
    WHERE organization_id = get_user_organization_id()
  )
);

-- Add comment
COMMENT ON TABLE public.action_implementation_updates IS 'Tracks daily implementation updates for actions with full history and accountability. Uses RLS for organization filtering.';
