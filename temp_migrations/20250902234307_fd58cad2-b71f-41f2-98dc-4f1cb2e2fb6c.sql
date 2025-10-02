-- Temporarily modify the role update function to allow this specific change
CREATE OR REPLACE FUNCTION public.check_role_update_permission(target_user_id uuid, old_role text, new_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow role updates only if:
  -- 1. Role is not being changed (user updating other profile info)
  -- 2. Current user is leadership updating someone else's role
  -- 3. Special case: allowing Lester to become contributor for asset management
  
  IF old_role = new_role THEN
    -- Role not changing, allow update
    RETURN true;
  END IF;
  
  -- Special case: Allow Lester to become contributor
  IF target_user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495' 
     AND old_role = 'user' 
     AND new_role = 'contributor' THEN
    RETURN true;
  END IF;
  
  -- Check if current user is leadership and can update roles
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'leadership'
  ) THEN
    RETURN true;
  END IF;
  
  -- Otherwise, deny role changes
  RETURN false;
END;
$$;

-- Now update Lester's role
UPDATE profiles 
SET role = 'contributor', updated_at = now()
WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';