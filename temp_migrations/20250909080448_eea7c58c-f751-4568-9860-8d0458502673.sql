-- Phase 1: Enhance organization_members table
-- Add full_name and super_admin columns to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN full_name TEXT,
ADD COLUMN super_admin BOOLEAN DEFAULT false;

-- Migrate existing data from profiles to organization_members
UPDATE public.organization_members 
SET 
  full_name = profiles.full_name,
  super_admin = COALESCE(profiles.super_admin, false)
FROM public.profiles 
WHERE organization_members.user_id = profiles.user_id;

-- Phase 2: Update Database Functions
-- Update get_user_display_name to use organization_members
CREATE OR REPLACE FUNCTION public.get_user_display_name(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the full name for the requested user from organization_members
  RETURN (
    SELECT full_name 
    FROM organization_members 
    WHERE user_id = target_user_id
    AND organization_id = get_user_organization_id()
    LIMIT 1
  );
END;
$$;

-- Update get_user_display_names to use organization_members
CREATE OR REPLACE FUNCTION public.get_user_display_names()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Return user_id and full_name pairs for users in the same organization
  RETURN QUERY
  SELECT om.user_id, om.full_name 
  FROM organization_members om
  WHERE om.organization_id = get_user_organization_id()
  AND om.full_name IS NOT NULL;
END;
$$;

-- Create new function to check if user is super admin using organization_members
CREATE OR REPLACE FUNCTION public.is_super_admin_org()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(super_admin, false) 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  AND organization_id = get_user_organization_id()
  LIMIT 1;
$$;

-- Update the profile creation trigger to populate organization_members
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert into profiles (minimal data)
  INSERT INTO profiles (user_id)
  VALUES (new.id);
  
  -- The organization_members entry will be created by invitation flow
  -- or by super admin when creating organizations
  
  RETURN new;
END;
$$;

-- Phase 4: Clean up profiles table (remove role and full_name columns)
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS role,
DROP COLUMN IF EXISTS full_name;