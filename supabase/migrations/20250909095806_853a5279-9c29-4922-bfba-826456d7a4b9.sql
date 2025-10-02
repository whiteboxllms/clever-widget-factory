-- Update all existing 'leadership' role members to 'admin'
UPDATE organization_members 
SET role = 'admin' 
WHERE role = 'leadership';

-- Update database function: is_organization_admin() to only check for admin
CREATE OR REPLACE FUNCTION public.is_organization_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$function$;

-- Update database function: create_organization_with_admin() to create admin instead of leadership
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(org_name text, org_subdomain text DEFAULT NULL::text, admin_user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  
  -- Add the admin user as admin member
  INSERT INTO organization_members (organization_id, user_id, role, invited_by)
  VALUES (new_org_id, admin_user_id, 'admin', auth.uid());
  
  RETURN new_org_id;
END;
$function$;

-- Update database function: check_role_update_permission() to only check for admin
CREATE OR REPLACE FUNCTION public.check_role_update_permission(target_user_id uuid, old_role text, new_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow role updates only if:
  -- 1. Role is not being changed (user updating other profile info)
  -- 2. Current user is admin updating someone else's role
  
  IF old_role = new_role THEN
    -- Role not changing, allow update
    RETURN true;
  END IF;
  
  -- Check if current user is admin and can update roles
  IF EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;
  
  -- Otherwise, deny role changes
  RETURN false;
END;
$function$;