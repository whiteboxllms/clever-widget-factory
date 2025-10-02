-- CRITICAL SECURITY FIXES
-- Phase 1: Fix Data Exposure Issues

-- Drop public SELECT policies that expose sensitive business data
DROP POLICY IF EXISTS "Authenticated users can view missions" ON public.missions;
DROP POLICY IF EXISTS "Authenticated users can view mission attachments" ON public.mission_attachments;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can view parts" ON public.parts;
DROP POLICY IF EXISTS "Authenticated users can view parts history" ON public.parts_history;
DROP POLICY IF EXISTS "Authenticated users can view mission tool usage" ON public.mission_tool_usage;
DROP POLICY IF EXISTS "Authenticated users can view inventory usage" ON public.inventory_usage;

-- Create secure authentication-based SELECT policies
CREATE POLICY "Authenticated users can view missions" 
ON public.missions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view mission attachments" 
ON public.mission_attachments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view parts" 
ON public.parts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view parts history" 
ON public.parts_history 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view mission tool usage" 
ON public.mission_tool_usage 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view inventory usage" 
ON public.inventory_usage 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Phase 2: Secure Database Functions
-- Add SET search_path to prevent SQL injection attacks

CREATE OR REPLACE FUNCTION public.capitalize_serial_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Capitalize serial_number if it's not null
  IF NEW.serial_number IS NOT NULL THEN
    NEW.serial_number = UPPER(NEW.serial_number);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_mission_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.mission_number IS NULL THEN
    NEW.mission_number = nextval('mission_number_seq');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capitalize_tool_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Capitalize each word in the tool name
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capitalize_vicinity_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Capitalize each word in the vicinity name and trim whitespace
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(trim(NEW.name));
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_display_name(target_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the full name for the requested user
  RETURN (
    SELECT full_name 
    FROM profiles 
    WHERE user_id = target_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_display_names()
 RETURNS TABLE(user_id uuid, full_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Return user_id and full_name pairs for all users
  RETURN QUERY
  SELECT p.user_id, p.full_name 
  FROM profiles p
  WHERE p.full_name IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_role_update_permission(target_user_id uuid, old_role text, new_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if role update is authorized
  IF NOT check_role_update_permission(NEW.user_id, OLD.role, NEW.role) THEN
    RAISE EXCEPTION 'Insufficient permissions to change user role';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_checkout_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only validate on INSERT operations for new checkouts
  IF TG_OP = 'INSERT' THEN
    -- Check if tool already has an active checkout
    IF EXISTS (
      SELECT 1 FROM checkouts 
      WHERE tool_id = NEW.tool_id 
        AND is_returned = false 
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Tool already has an active checkout. Tool ID: %', NEW.tool_id;
    END IF;
    
    -- Ensure tool status is available before allowing checkout
    IF NOT EXISTS (
      SELECT 1 FROM tools 
      WHERE id = NEW.tool_id 
        AND status = 'available'
    ) THEN
      RAISE EXCEPTION 'Tool is not available for checkout. Current status must be "available".';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$function$;