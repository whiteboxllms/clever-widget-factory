-- Add triggers to automatically set organization_id for all tables that need it
-- This ensures organization_id is always set securely server-side

-- Actions table trigger
DROP TRIGGER IF EXISTS set_organization_id_actions_trigger ON actions;
CREATE TRIGGER set_organization_id_actions_trigger
  BEFORE INSERT ON actions
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_actions();

-- Issues table trigger  
CREATE OR REPLACE FUNCTION set_organization_id_for_issues()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organization_id_issues_trigger ON issues;
CREATE TRIGGER set_organization_id_issues_trigger
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_issues();

-- Tools table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_tools()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organization_id_tools_trigger ON tools;
CREATE TRIGGER set_organization_id_tools_trigger
  BEFORE INSERT ON tools
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_tools();

-- Parts table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_parts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organization_id_parts_trigger ON parts;
CREATE TRIGGER set_organization_id_parts_trigger
  BEFORE INSERT ON parts
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_parts();

-- Checkouts table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_checkouts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organization_id_checkouts_trigger ON checkouts;
CREATE TRIGGER set_organization_id_checkouts_trigger
  BEFORE INSERT ON checkouts
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_checkouts();

-- Missions table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_missions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_organization_id_missions_trigger ON missions;
CREATE TRIGGER set_organization_id_missions_trigger
  BEFORE INSERT ON missions
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_missions();