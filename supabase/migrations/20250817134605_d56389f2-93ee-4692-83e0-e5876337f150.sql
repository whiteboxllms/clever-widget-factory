-- CRITICAL SECURITY FIXES - Phase 2: Role Protection

-- Create a security definer function to safely check if user can update roles
CREATE OR REPLACE FUNCTION public.check_role_update_permission(target_user_id uuid, old_role text, new_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow role updates only if:
  -- 1. Role is not being changed (user updating other profile info)
  -- 2. Current user is leadership updating someone else's role
  
  IF old_role = new_role THEN
    -- Role not changing, allow update
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

-- Update the profile update policy to use the security function
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile with role protection" 
ON public.profiles
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add a WITH CHECK constraint using the security function
-- Note: We'll implement this as a trigger since RLS WITH CHECK doesn't support function calls with OLD values

-- Create trigger function to prevent unauthorized role changes
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if role update is authorized
  IF NOT check_role_update_permission(NEW.user_id, OLD.role, NEW.role) THEN
    RAISE EXCEPTION 'Insufficient permissions to change user role';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS profile_role_update_check ON public.profiles;
CREATE TRIGGER profile_role_update_check
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unauthorized_role_changes();