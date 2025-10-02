-- Fix the search path security issue in the functions
CREATE OR REPLACE FUNCTION public.get_user_display_name(target_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the full name for the requested user
  RETURN (
    SELECT full_name 
    FROM public.profiles 
    WHERE user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Fix the search path for the batch function too
CREATE OR REPLACE FUNCTION public.get_user_display_names()
RETURNS TABLE(user_id UUID, full_name TEXT) AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Return user_id and full_name pairs for all users
  RETURN QUERY
  SELECT p.user_id, p.full_name 
  FROM public.profiles p
  WHERE p.full_name IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';