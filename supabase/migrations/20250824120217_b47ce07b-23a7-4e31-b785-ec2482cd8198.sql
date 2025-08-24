-- Fix security issue: Restrict tools table access to authenticated users only
-- Remove the overly permissive SELECT policy and replace with authenticated-only access

-- Drop the current overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view tools" ON public.tools;

-- Create a new policy that restricts SELECT access to authenticated users only
CREATE POLICY "Authenticated users can view tools" 
ON public.tools 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Ensure the existing management policy is also properly scoped
DROP POLICY IF EXISTS "Authenticated users can manage tools" ON public.tools;

CREATE POLICY "Authenticated users can manage tools" 
ON public.tools 
FOR ALL 
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);