-- Add remaining triggers for tables that were missing them

-- Issue history table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_issue_history()
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

DROP TRIGGER IF EXISTS set_organization_id_issue_history_trigger ON issue_history;
CREATE TRIGGER set_organization_id_issue_history_trigger
  BEFORE INSERT ON issue_history
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_issue_history();

-- Mission tool usage table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_mission_tool_usage()
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

DROP TRIGGER IF EXISTS set_organization_id_mission_tool_usage_trigger ON mission_tool_usage;
CREATE TRIGGER set_organization_id_mission_tool_usage_trigger
  BEFORE INSERT ON mission_tool_usage
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_mission_tool_usage();

-- Mission attachments table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_mission_attachments()
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

DROP TRIGGER IF EXISTS set_organization_id_mission_attachments_trigger ON mission_attachments;
CREATE TRIGGER set_organization_id_mission_attachments_trigger
  BEFORE INSERT ON mission_attachments
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_mission_attachments();

-- Parts history table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_parts_history()
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

DROP TRIGGER IF EXISTS set_organization_id_parts_history_trigger ON parts_history;
CREATE TRIGGER set_organization_id_parts_history_trigger
  BEFORE INSERT ON parts_history
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_parts_history();

-- Parts orders table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_parts_orders()
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

DROP TRIGGER IF EXISTS set_organization_id_parts_orders_trigger ON parts_orders;
CREATE TRIGGER set_organization_id_parts_orders_trigger
  BEFORE INSERT ON parts_orders
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_parts_orders();

-- Storage vicinities table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_storage_vicinities()
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

DROP TRIGGER IF EXISTS set_organization_id_storage_vicinities_trigger ON storage_vicinities;
CREATE TRIGGER set_organization_id_storage_vicinities_trigger
  BEFORE INSERT ON storage_vicinities
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_storage_vicinities();

-- Tool audits table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_tool_audits()
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

DROP TRIGGER IF EXISTS set_organization_id_tool_audits_trigger ON tool_audits;
CREATE TRIGGER set_organization_id_tool_audits_trigger
  BEFORE INSERT ON tool_audits
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_tool_audits();

-- Checkins table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_checkins()
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

DROP TRIGGER IF EXISTS set_organization_id_checkins_trigger ON checkins;
CREATE TRIGGER set_organization_id_checkins_trigger
  BEFORE INSERT ON checkins
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_checkins();

-- Worker attributes table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_worker_attributes()
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

DROP TRIGGER IF EXISTS set_organization_id_worker_attributes_trigger ON worker_attributes;
CREATE TRIGGER set_organization_id_worker_attributes_trigger
  BEFORE INSERT ON worker_attributes
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_worker_attributes();

-- Worker strategic attributes table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_worker_strategic_attributes()
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

DROP TRIGGER IF EXISTS set_organization_id_worker_strategic_attributes_trigger ON worker_strategic_attributes;
CREATE TRIGGER set_organization_id_worker_strategic_attributes_trigger
  BEFORE INSERT ON worker_strategic_attributes
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_worker_strategic_attributes();

-- Issue requirements table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_issue_requirements()
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

DROP TRIGGER IF EXISTS set_organization_id_issue_requirements_trigger ON issue_requirements;
CREATE TRIGGER set_organization_id_issue_requirements_trigger
  BEFORE INSERT ON issue_requirements
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_issue_requirements();

-- Worker performance table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_worker_performance()
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

DROP TRIGGER IF EXISTS set_organization_id_worker_performance_trigger ON worker_performance;
CREATE TRIGGER set_organization_id_worker_performance_trigger
  BEFORE INSERT ON worker_performance
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_worker_performance();

-- Inventory usage table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_inventory_usage()
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

DROP TRIGGER IF EXISTS set_organization_id_inventory_usage_trigger ON inventory_usage;
CREATE TRIGGER set_organization_id_inventory_usage_trigger
  BEFORE INSERT ON inventory_usage
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_inventory_usage();

-- Scoring prompts table trigger
CREATE OR REPLACE FUNCTION set_organization_id_for_scoring_prompts()
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

DROP TRIGGER IF EXISTS set_organization_id_scoring_prompts_trigger ON scoring_prompts;
CREATE TRIGGER set_organization_id_scoring_prompts_trigger
  BEFORE INSERT ON scoring_prompts
  FOR EACH ROW EXECUTE FUNCTION set_organization_id_for_scoring_prompts();