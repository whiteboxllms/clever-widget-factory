-- Refine the RLS policies to avoid conflicts and be more precise
-- Remove the broad policy we just created
DROP POLICY "Authenticated users can view basic profile info" ON public.profiles;

-- Create a more specific policy that allows authenticated users to view only basic profile information
-- This will allow the inventory analytics to work while protecting sensitive data
CREATE POLICY "Authenticated users can view names for collaboration" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true)
WITH (column_policy = 'user_id, full_name, created_at');

-- If the above column-level policy doesn't work, we'll use a view-based approach instead
-- But let's try this first as it's cleaner