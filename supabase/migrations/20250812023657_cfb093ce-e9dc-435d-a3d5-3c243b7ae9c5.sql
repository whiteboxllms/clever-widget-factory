-- Create a secure view for public profile information that only exposes safe fields
-- This provides better security than broad RLS policies
CREATE OR REPLACE VIEW public.user_display_info AS
SELECT 
  user_id,
  full_name,
  created_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.user_display_info SET ROW SECURITY;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.user_display_info TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Authenticated users can view user display info" 
ON public.user_display_info 
FOR SELECT 
TO authenticated
USING (true);