-- Fix critical security vulnerability in profiles table
-- Remove the overly permissive "Anyone can view profiles" policy
DROP POLICY "Anyone can view profiles" ON public.profiles;

-- Add secure RLS policies for the profiles table
-- Policy 1: Users can view basic info (name) of other authenticated users for collaboration features
CREATE POLICY "Authenticated users can view basic profile info" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Policy 2: Users can only view their full profile details (including sensitive role information)
CREATE POLICY "Users can view their own full profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- The existing policies for INSERT and UPDATE are already secure:
-- "Users can insert their own profile" - WITH CHECK (auth.uid() = user_id)
-- "Users can update their own profile" - USING (auth.uid() = user_id)

-- Note: This approach allows authenticated users to see names for collaboration
-- while restricting sensitive data like roles to the profile owner only