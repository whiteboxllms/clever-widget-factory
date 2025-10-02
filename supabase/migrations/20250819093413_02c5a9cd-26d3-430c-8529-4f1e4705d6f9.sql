-- Update RLS policy for tool_issues to allow anyone to create issues
-- This supports the workflow where anyone can find and check in a tool

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create tool issues" ON public.tool_issues;

-- Create a new policy that allows any authenticated user to create tool issues
CREATE POLICY "Any authenticated user can create tool issues" 
ON public.tool_issues 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Also check if there are any check constraints that might be causing issues
-- Let's see what constraints exist on the tool_issues table
SELECT conname, pg_get_constraintdef(oid) as definition 
FROM pg_constraint 
WHERE conrelid = 'public.tool_issues'::regclass;