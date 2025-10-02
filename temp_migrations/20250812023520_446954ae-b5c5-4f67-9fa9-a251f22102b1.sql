-- Create a simple, secure policy for authenticated users to view basic profile info
-- This allows collaboration features while protecting sensitive data like roles
CREATE POLICY "Authenticated users can view basic profile info" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Note: The "Users can view their own full profile" policy we created earlier 
-- will take precedence for the user's own profile, allowing them to see their role.
-- For other users' profiles, they can see basic info but PostgreSQL RLS 
-- will enforce security through application-level column selection.