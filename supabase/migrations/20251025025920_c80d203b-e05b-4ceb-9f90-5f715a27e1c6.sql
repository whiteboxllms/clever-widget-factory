-- Fix get_user_display_name to query organization_members instead of profiles
CREATE OR REPLACE FUNCTION public.get_user_display_name(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the full name from organization_members for the requested user
  RETURN (
    SELECT full_name 
    FROM organization_members 
    WHERE user_id = target_user_id
    AND is_active = true
    LIMIT 1
  );
END;
$$;

-- Fix get_user_display_names to query organization_members instead of profiles
CREATE OR REPLACE FUNCTION public.get_user_display_names()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Return user_id and full_name pairs from organization_members
  RETURN QUERY
  SELECT om.user_id, om.full_name 
  FROM organization_members om
  WHERE om.full_name IS NOT NULL
  AND om.is_active = true;
END;
$$;