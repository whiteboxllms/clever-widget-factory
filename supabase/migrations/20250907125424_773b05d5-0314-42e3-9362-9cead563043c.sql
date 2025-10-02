-- Update the default organization to Stargazer Farm
UPDATE organizations 
SET name = 'Stargazer Farm', subdomain = 'stargazer-farm' 
WHERE name = 'Default Organization';

-- Add super_admin flag to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS super_admin boolean DEFAULT false;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COALESCE(super_admin, false) 
  FROM profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$function$;

-- Update RLS policies for organizations to allow super admins
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
CREATE POLICY "Super admins can view all organizations" 
ON organizations 
FOR SELECT 
USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
CREATE POLICY "Super admins can manage all organizations" 
ON organizations 
FOR ALL 
USING (is_super_admin());

-- Update RLS policies for organization_members to allow super admins
DROP POLICY IF EXISTS "Super admins can view all organization members" ON organization_members;
CREATE POLICY "Super admins can view all organization members" 
ON organization_members 
FOR SELECT 
USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can manage all organization members" ON organization_members;
CREATE POLICY "Super admins can manage all organization members" 
ON organization_members 
FOR ALL 
USING (is_super_admin());

-- Create function to create new organization with initial admin
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  org_name text,
  org_subdomain text DEFAULT NULL,
  admin_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_org_id uuid;
BEGIN
  -- Only allow super admins to create organizations
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can create organizations';
  END IF;
  
  -- Create the organization
  INSERT INTO organizations (name, subdomain)
  VALUES (org_name, org_subdomain)
  RETURNING id INTO new_org_id;
  
  -- Add the admin user as leadership member
  INSERT INTO organization_members (organization_id, user_id, role, invited_by)
  VALUES (new_org_id, admin_user_id, 'leadership', auth.uid());
  
  RETURN new_org_id;
END;
$function$;