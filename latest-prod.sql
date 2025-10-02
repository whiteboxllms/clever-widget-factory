

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."action_required_type" AS ENUM (
    'repair',
    'replace_part',
    'not_fixable',
    'remove'
);


ALTER TYPE "public"."action_required_type" OWNER TO "postgres";


CREATE TYPE "public"."attribute_type" AS ENUM (
    'communication',
    'quality',
    'transparency',
    'reliability',
    'mechanical',
    'electrical',
    'it',
    'carpentry',
    'plumbing',
    'hydraulics',
    'welding',
    'fabrication'
);


ALTER TYPE "public"."attribute_type" OWNER TO "postgres";


CREATE TYPE "public"."context_type" AS ENUM (
    'tool',
    'order',
    'inventory',
    'facility'
);


ALTER TYPE "public"."context_type" OWNER TO "postgres";


CREATE TYPE "public"."strategic_attribute_type" AS ENUM (
    'growth_mindset',
    'root_cause_problem_solving',
    'teamwork',
    'quality',
    'proactive_documentation',
    'safety_focus',
    'efficiency',
    'asset_stewardship',
    'financial_impact',
    'energy_morale_impact'
);


ALTER TYPE "public"."strategic_attribute_type" OWNER TO "postgres";


CREATE TYPE "public"."tool_status" AS ENUM (
    'available',
    'checked_out',
    'unavailable',
    'needs_attention',
    'under_repair',
    'removed'
);


ALTER TYPE "public"."tool_status" OWNER TO "postgres";


CREATE TYPE "public"."workflow_status_type" AS ENUM (
    'reported',
    'diagnosed',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."workflow_status_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capitalize_serial_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Capitalize serial_number if it's not null
  IF NEW.serial_number IS NOT NULL THEN
    NEW.serial_number = UPPER(NEW.serial_number);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capitalize_serial_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capitalize_tool_name"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Capitalize each word in the tool name
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capitalize_tool_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capitalize_vicinity_name"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Capitalize each word in the vicinity name and trim whitespace
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(trim(NEW.name));
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capitalize_vicinity_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_role_update_permission"("target_user_id" "uuid", "old_role" "text", "new_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."check_role_update_permission"("target_user_id" "uuid", "old_role" "text", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization_with_admin"("org_name" "text", "org_subdomain" "text" DEFAULT NULL::"text", "admin_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_organization_with_admin"("org_name" "text", "org_subdomain" "text", "admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_mission_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.mission_number IS NULL THEN
    NEW.mission_number = nextval('mission_number_seq');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_mission_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("target_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_display_name"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_names"() RETURNS TABLE("user_id" "uuid", "full_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_display_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organization_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_organization_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_organization_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(super_admin, false) 
  FROM profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_unauthorized_role_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if role update is authorized
  IF NOT check_role_update_permission(NEW.user_id, OLD.role, NEW.role) THEN
    RAISE EXCEPTION 'Insufficient permissions to change user role';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_unauthorized_role_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_action_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_action_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_actions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_actions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_checkins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_checkins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_checkouts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_checkouts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_inventory_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_inventory_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_issue_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_issue_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_issue_requirements"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_issue_requirements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_issues"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_issues"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_mission_attachments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_mission_attachments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_mission_tool_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_mission_tool_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_missions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_missions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_parts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_parts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_parts_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_parts_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_parts_orders"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_parts_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_scoring_prompts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_scoring_prompts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_storage_vicinities"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_storage_vicinities"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_tool_audits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_tool_audits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_tools"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_tools"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_worker_attributes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_worker_attributes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_worker_performance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_worker_performance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_for_worker_strategic_attributes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_for_worker_strategic_attributes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_checkout_operation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_checkout_operation"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "source_type" "text" DEFAULT 'action'::"text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_response" "jsonb" DEFAULT '{}'::"jsonb",
    "likely_root_causes" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_context_id" "uuid",
    "asset_context_name" "text",
    "score_attribution_type" "text" DEFAULT 'action'::"text",
    "organization_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000000'::"uuid" NOT NULL
);


ALTER TABLE "public"."action_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "evidence_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "qa_approved_at" timestamp with time zone,
    "policy" "text",
    "observations" "text",
    "estimated_duration" "text",
    "actual_duration" "text",
    "required_tools" "text"[],
    "linked_issue_id" "uuid",
    "issue_reference" "text",
    "attachments" "text"[] DEFAULT '{}'::"text"[],
    "asset_id" "uuid",
    "score" numeric,
    "scoring_data" "jsonb" DEFAULT '{}'::"jsonb",
    "required_stock" "jsonb" DEFAULT '[]'::"jsonb",
    "plan_commitment" boolean DEFAULT false,
    "participants" "uuid"[] DEFAULT '{}'::"uuid"[],
    "organization_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000000'::"uuid" NOT NULL,
    CONSTRAINT "mission_tasks_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text", 'qa_approved'::"text"])))
);

ALTER TABLE ONLY "public"."actions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."actions" OWNER TO "postgres";


COMMENT ON TABLE "public"."actions" IS 'Unified actions table for all types of actions: mission, issue, asset, and policy actions';



COMMENT ON COLUMN "public"."actions"."estimated_duration" IS 'Estimated time to complete this task (e.g., "2 hours", "30 minutes")';



COMMENT ON COLUMN "public"."actions"."actual_duration" IS 'Actual time taken to complete this task';



COMMENT ON COLUMN "public"."actions"."required_tools" IS 'Array of tool names/IDs required for this task';



COMMENT ON COLUMN "public"."actions"."asset_id" IS 'Optional link to specific asset/tool';



COMMENT ON COLUMN "public"."actions"."score" IS 'RL-based score for completed actions';



COMMENT ON COLUMN "public"."actions"."scoring_data" IS 'Detailed scoring information and metadata';



COMMENT ON COLUMN "public"."actions"."required_stock" IS 'Array of stock items required for this action, stored as JSON objects with part_id, quantity, and part_name';



COMMENT ON COLUMN "public"."actions"."participants" IS 'Array of user IDs representing support individuals for this action';



CREATE TABLE IF NOT EXISTS "public"."checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checkout_id" "uuid",
    "tool_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "checkin_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "problems_reported" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hours_used" numeric,
    "after_image_urls" "text"[] DEFAULT '{}'::"text"[],
    "sop_best_practices" "text" DEFAULT ''::"text" NOT NULL,
    "what_did_you_do" "text" DEFAULT ''::"text" NOT NULL,
    "checkin_reason" "text",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."checkins" OWNER TO "postgres";


COMMENT ON COLUMN "public"."checkins"."hours_used" IS 'Number of hours the tool was used (for motor tools only)';



COMMENT ON COLUMN "public"."checkins"."after_image_urls" IS 'Array of URLs for multiple after-use images';



CREATE TABLE IF NOT EXISTS "public"."checkouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tool_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "intended_usage" "text",
    "checkout_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expected_return_date" "date",
    "before_image_url" "text",
    "notes" "text",
    "is_returned" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pre_existing_issues" "text",
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."checkouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "part_id" "uuid" NOT NULL,
    "quantity_used" numeric(10,3) NOT NULL,
    "usage_description" "text",
    "used_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "field_changed" "text",
    "old_value" "text",
    "new_value" "text",
    "notes" "text",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."issue_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid",
    "attribute_type" "public"."attribute_type" NOT NULL,
    "required_level" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "issue_requirements_required_level_check" CHECK (("required_level" >= 0))
);


ALTER TABLE "public"."issue_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "context_type" "public"."context_type" DEFAULT 'tool'::"public"."context_type" NOT NULL,
    "context_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_misuse" boolean DEFAULT false NOT NULL,
    "related_checkout_id" "uuid",
    "responsibility_assigned" boolean DEFAULT false NOT NULL,
    "efficiency_loss_percentage" numeric,
    "action_required" "public"."action_required_type",
    "workflow_status" "public"."workflow_status_type" DEFAULT 'reported'::"public"."workflow_status_type" NOT NULL,
    "diagnosed_by" "uuid",
    "diagnosed_at" timestamp with time zone,
    "assigned_to" "uuid",
    "ready_to_work" boolean DEFAULT false,
    "materials_needed" "jsonb" DEFAULT '[]'::"jsonb",
    "can_self_claim" boolean DEFAULT false,
    "estimated_hours" numeric,
    "actual_hours" numeric,
    "issue_type" "text" DEFAULT 'efficiency'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "report_photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "root_cause" "text",
    "resolution_notes" "text",
    "resolution_photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "next_steps" "text",
    "ai_analysis" "text",
    "damage_assessment" "text",
    "work_progress" "text",
    "description" "text" NOT NULL,
    "issue_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid",
    "task_id" "uuid",
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "attachment_type" "text" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "mission_attachments_attachment_type_check" CHECK (("attachment_type" = ANY (ARRAY['problem_statement'::"text", 'evidence'::"text", 'plan'::"text"])))
);


ALTER TABLE "public"."mission_attachments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mission_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mission_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_tool_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "checkout_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."mission_tool_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "problem_statement" "text" NOT NULL,
    "resources_required" "text",
    "all_materials_available" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'planning'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "qa_assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "template_id" "text",
    "template_name" "text",
    "template_color" "text",
    "template_icon" "text",
    "mission_number" integer DEFAULT "nextval"('"public"."mission_number_seq"'::"regclass") NOT NULL,
    "qa_feedback" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "missions_status_check" CHECK (("status" = ANY (ARRAY['planning'::"text", 'in_progress'::"text", 'qa_review'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "full_name" "text",
    "super_admin" boolean DEFAULT false
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "subdomain" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "storage_vicinity" "text",
    "current_quantity" numeric(10,3) DEFAULT 0 NOT NULL,
    "minimum_quantity" numeric(10,3) DEFAULT 0,
    "unit" "text" DEFAULT 'pieces'::"text",
    "cost_per_unit" numeric(10,2),
    "supplier" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supplier_id" "uuid",
    "storage_location" "text",
    "cost_evidence_url" "text",
    "legacy_storage_vicinity" "text",
    "organization_id" "uuid" NOT NULL,
    "parent_structure_id" "uuid"
);


ALTER TABLE "public"."parts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parts"."parent_structure_id" IS 'References tools with category Infrastructure or Container for storage hierarchy';



CREATE TABLE IF NOT EXISTS "public"."parts_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "part_id" "uuid" NOT NULL,
    "change_type" "text" NOT NULL,
    "old_quantity" numeric(10,3),
    "new_quantity" numeric(10,3),
    "quantity_change" numeric(10,3),
    "change_reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "order_id" "uuid",
    "supplier_name" "text",
    "supplier_url" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "parts_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['quantity_add'::"text", 'quantity_remove'::"text", 'update'::"text", 'create'::"text"])))
);


ALTER TABLE "public"."parts_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parts_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "part_id" "uuid" NOT NULL,
    "quantity_ordered" numeric NOT NULL,
    "quantity_received" numeric DEFAULT 0 NOT NULL,
    "supplier_name" "text",
    "supplier_id" "uuid",
    "estimated_cost" numeric,
    "order_details" "text",
    "notes" "text",
    "expected_delivery_date" "date",
    "ordered_by" "uuid" NOT NULL,
    "ordered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "valid_quantities" CHECK ((("quantity_ordered" > (0)::numeric) AND ("quantity_received" >= (0)::numeric))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'partially_received'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."parts_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "super_admin" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scoring_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."scoring_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_vicinities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."storage_vicinities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_info" "jsonb" DEFAULT '{}'::"jsonb",
    "quality_rating" numeric DEFAULT 0,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."suppliers"."name" IS 'Supplier names follow these conventions: Proper case for companies, UPPERCASE for countries/regions, periods for abbreviations (D.A.)';



CREATE TABLE IF NOT EXISTS "public"."tool_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tool_id" "uuid" NOT NULL,
    "audited_by" "uuid" NOT NULL,
    "audited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "audit_comments" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "flagged_for_maintenance" boolean DEFAULT false NOT NULL,
    "last_user_identified" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tool_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "legacy_storage_vicinity" "text" DEFAULT 'General'::"text",
    "actual_location" "text",
    "status" "public"."tool_status" DEFAULT 'available'::"public"."tool_status" NOT NULL,
    "serial_number" "text",
    "last_maintenance" "date",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "manual_url" "text",
    "known_issues" "text",
    "has_motor" boolean DEFAULT false NOT NULL,
    "stargazer_sop" "text",
    "storage_location" "text",
    "last_audited_at" timestamp with time zone,
    "audit_status" "text" DEFAULT 'never_audited'::"text",
    "parent_structure_id" "uuid",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."tools" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tools"."has_motor" IS 'Indicates if the tool has a motor and requires hour tracking';



CREATE TABLE IF NOT EXISTS "public"."worker_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "attribute_type" "public"."attribute_type" NOT NULL,
    "level" integer DEFAULT 0,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "worker_attributes_level_check" CHECK (("level" >= 0))
);


ALTER TABLE "public"."worker_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "issue_id" "uuid",
    "outcome" "text",
    "attributes_used" "public"."attribute_type"[],
    "level_at_completion" integer,
    "completion_notes" "text",
    "supervisor_notes" "text",
    "hours_worked" numeric,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "worker_performance_outcome_check" CHECK (("outcome" = ANY (ARRAY['successful'::"text", 'failed'::"text", 'escalated'::"text", 'incomplete'::"text"])))
);


ALTER TABLE "public"."worker_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_strategic_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "attribute_type" "public"."strategic_attribute_type" NOT NULL,
    "level" integer DEFAULT 0,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."worker_strategic_attributes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_scores"
    ADD CONSTRAINT "action_scores_action_id_unique" UNIQUE ("action_id");



ALTER TABLE ONLY "public"."action_scores"
    ADD CONSTRAINT "action_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkouts"
    ADD CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issue_history"
    ADD CONSTRAINT "issue_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issue_requirements"
    ADD CONSTRAINT "issue_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_attachments"
    ADD CONSTRAINT "mission_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_usage"
    ADD CONSTRAINT "mission_inventory_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "mission_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_tool_usage"
    ADD CONSTRAINT "mission_tool_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."parts_history"
    ADD CONSTRAINT "parts_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parts_orders"
    ADD CONSTRAINT "parts_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."scoring_prompts"
    ADD CONSTRAINT "scoring_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_vicinities"
    ADD CONSTRAINT "storage_vicinities_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."storage_vicinities"
    ADD CONSTRAINT "storage_vicinities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tool_audits"
    ADD CONSTRAINT "tool_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "unique_mission_number" UNIQUE ("mission_number");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "unique_organization_members_user_id" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."worker_attributes"
    ADD CONSTRAINT "worker_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_attributes"
    ADD CONSTRAINT "worker_attributes_user_id_attribute_type_key" UNIQUE ("user_id", "attribute_type");



ALTER TABLE ONLY "public"."worker_performance"
    ADD CONSTRAINT "worker_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_strategic_attributes"
    ADD CONSTRAINT "worker_strategic_attributes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_action_scores_action_id" ON "public"."action_scores" USING "btree" ("action_id");



CREATE INDEX "idx_action_scores_attribution_type" ON "public"."action_scores" USING "btree" ("score_attribution_type");



CREATE INDEX "idx_action_scores_created_at" ON "public"."action_scores" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_action_scores_source_id" ON "public"."action_scores" USING "btree" ("source_id");



CREATE INDEX "idx_actions_organization_id" ON "public"."actions" USING "btree" ("organization_id");



CREATE INDEX "idx_issues_organization_id" ON "public"."issues" USING "btree" ("organization_id");



CREATE INDEX "idx_mission_actions_linked_issue_id" ON "public"."actions" USING "btree" ("linked_issue_id");



CREATE INDEX "idx_missions_mission_number" ON "public"."missions" USING "btree" ("mission_number");



CREATE INDEX "idx_missions_organization_id" ON "public"."missions" USING "btree" ("organization_id");



CREATE INDEX "idx_missions_qa_feedback" ON "public"."missions" USING "btree" ("qa_feedback");



CREATE INDEX "idx_organization_members_org_id" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_members_user_id" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_parts_history_changed_at" ON "public"."parts_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_parts_history_order_id" ON "public"."parts_history" USING "btree" ("order_id");



CREATE INDEX "idx_parts_history_part_id" ON "public"."parts_history" USING "btree" ("part_id");



CREATE INDEX "idx_parts_orders_part_id" ON "public"."parts_orders" USING "btree" ("part_id");



CREATE INDEX "idx_parts_orders_status" ON "public"."parts_orders" USING "btree" ("status");



CREATE INDEX "idx_parts_organization_id" ON "public"."parts" USING "btree" ("organization_id");



CREATE INDEX "idx_parts_supplier_id" ON "public"."parts" USING "btree" ("supplier_id");



CREATE INDEX "idx_tools_category_for_parents" ON "public"."tools" USING "btree" ("category") WHERE ("category" = ANY (ARRAY['Infrastructure'::"text", 'Container'::"text"]));



CREATE INDEX "idx_tools_organization_id" ON "public"."tools" USING "btree" ("organization_id");



CREATE INDEX "idx_tools_parent_structure" ON "public"."tools" USING "btree" ("parent_structure_id");



CREATE INDEX "idx_tools_status" ON "public"."tools" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_unique_active_checkout_per_tool" ON "public"."checkouts" USING "btree" ("tool_id") WHERE ("is_returned" = false);



CREATE OR REPLACE TRIGGER "capitalize_tool_name_trigger" BEFORE INSERT OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."capitalize_tool_name"();



CREATE OR REPLACE TRIGGER "capitalize_tools_serial_number" BEFORE INSERT OR UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."capitalize_serial_number"();



CREATE OR REPLACE TRIGGER "capitalize_vicinity_name_trigger" BEFORE INSERT OR UPDATE ON "public"."storage_vicinities" FOR EACH ROW EXECUTE FUNCTION "public"."capitalize_vicinity_name"();



CREATE OR REPLACE TRIGGER "set_mission_number" BEFORE INSERT ON "public"."missions" FOR EACH ROW EXECUTE FUNCTION "public"."generate_mission_number"();



CREATE OR REPLACE TRIGGER "set_organization_id_actions_trigger" BEFORE INSERT ON "public"."actions" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_actions"();



CREATE OR REPLACE TRIGGER "set_organization_id_checkins_trigger" BEFORE INSERT ON "public"."checkins" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_checkins"();



CREATE OR REPLACE TRIGGER "set_organization_id_checkouts_trigger" BEFORE INSERT ON "public"."checkouts" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_checkouts"();



CREATE OR REPLACE TRIGGER "set_organization_id_inventory_usage_trigger" BEFORE INSERT ON "public"."inventory_usage" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_inventory_usage"();



CREATE OR REPLACE TRIGGER "set_organization_id_issue_history_trigger" BEFORE INSERT ON "public"."issue_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_issue_history"();



CREATE OR REPLACE TRIGGER "set_organization_id_issue_requirements_trigger" BEFORE INSERT ON "public"."issue_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_issue_requirements"();



CREATE OR REPLACE TRIGGER "set_organization_id_issues_trigger" BEFORE INSERT ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_issues"();



CREATE OR REPLACE TRIGGER "set_organization_id_mission_attachments_trigger" BEFORE INSERT ON "public"."mission_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_mission_attachments"();



CREATE OR REPLACE TRIGGER "set_organization_id_mission_tool_usage_trigger" BEFORE INSERT ON "public"."mission_tool_usage" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_mission_tool_usage"();



CREATE OR REPLACE TRIGGER "set_organization_id_missions_trigger" BEFORE INSERT ON "public"."missions" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_missions"();



CREATE OR REPLACE TRIGGER "set_organization_id_parts_history_trigger" BEFORE INSERT ON "public"."parts_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_parts_history"();



CREATE OR REPLACE TRIGGER "set_organization_id_parts_orders_trigger" BEFORE INSERT ON "public"."parts_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_parts_orders"();



CREATE OR REPLACE TRIGGER "set_organization_id_parts_trigger" BEFORE INSERT ON "public"."parts" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_parts"();



CREATE OR REPLACE TRIGGER "set_organization_id_scoring_prompts_trigger" BEFORE INSERT ON "public"."scoring_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_scoring_prompts"();



CREATE OR REPLACE TRIGGER "set_organization_id_storage_vicinities_trigger" BEFORE INSERT ON "public"."storage_vicinities" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_storage_vicinities"();



CREATE OR REPLACE TRIGGER "set_organization_id_tool_audits_trigger" BEFORE INSERT ON "public"."tool_audits" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_tool_audits"();



CREATE OR REPLACE TRIGGER "set_organization_id_tools_trigger" BEFORE INSERT ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_tools"();



CREATE OR REPLACE TRIGGER "set_organization_id_worker_attributes_trigger" BEFORE INSERT ON "public"."worker_attributes" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_worker_attributes"();



CREATE OR REPLACE TRIGGER "set_organization_id_worker_performance_trigger" BEFORE INSERT ON "public"."worker_performance" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_worker_performance"();



CREATE OR REPLACE TRIGGER "set_organization_id_worker_strategic_attributes_trigger" BEFORE INSERT ON "public"."worker_strategic_attributes" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_worker_strategic_attributes"();



CREATE OR REPLACE TRIGGER "trigger_set_organization_id_action_scores" BEFORE INSERT ON "public"."action_scores" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_action_scores"();



CREATE OR REPLACE TRIGGER "trigger_set_organization_id_actions" BEFORE INSERT ON "public"."actions" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_for_actions"();



CREATE OR REPLACE TRIGGER "trigger_validate_checkout" BEFORE INSERT ON "public"."checkouts" FOR EACH ROW EXECUTE FUNCTION "public"."validate_checkout_operation"();



CREATE OR REPLACE TRIGGER "update_action_scores_updated_at" BEFORE UPDATE ON "public"."action_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_issues_updated_at" BEFORE UPDATE ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mission_tasks_updated_at" BEFORE UPDATE ON "public"."actions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_missions_updated_at" BEFORE UPDATE ON "public"."missions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_parts_orders_updated_at" BEFORE UPDATE ON "public"."parts_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_parts_updated_at" BEFORE UPDATE ON "public"."parts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_scoring_prompts_updated_at" BEFORE UPDATE ON "public"."scoring_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_storage_vicinities_updated_at" BEFORE UPDATE ON "public"."storage_vicinities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tools_updated_at" BEFORE UPDATE ON "public"."tools" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_attributes_updated_at" BEFORE UPDATE ON "public"."worker_attributes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."action_scores"
    ADD CONSTRAINT "action_scores_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_scores"
    ADD CONSTRAINT "action_scores_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "actions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkouts"
    ADD CONSTRAINT "checkouts_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkouts"
    ADD CONSTRAINT "checkouts_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkouts"
    ADD CONSTRAINT "checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "fk_actions_assigned_to_organization_members" FOREIGN KEY ("assigned_to") REFERENCES "public"."organization_members"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parts_history"
    ADD CONSTRAINT "fk_parts_history_changed_by" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "fk_parts_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."inventory_usage"
    ADD CONSTRAINT "inventory_usage_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_usage"
    ADD CONSTRAINT "inventory_usage_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_usage"
    ADD CONSTRAINT "inventory_usage_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id");



ALTER TABLE ONLY "public"."inventory_usage"
    ADD CONSTRAINT "inventory_usage_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_usage"
    ADD CONSTRAINT "inventory_usage_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."issue_history"
    ADD CONSTRAINT "issue_history_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_requirements"
    ADD CONSTRAINT "issue_requirements_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_attachments"
    ADD CONSTRAINT "mission_attachments_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_attachments"
    ADD CONSTRAINT "mission_attachments_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_attachments"
    ADD CONSTRAINT "mission_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_attachments"
    ADD CONSTRAINT "mission_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "mission_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "mission_tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_tool_usage"
    ADD CONSTRAINT "mission_tool_usage_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id");



ALTER TABLE ONLY "public"."mission_tool_usage"
    ADD CONSTRAINT "mission_tool_usage_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_tool_usage"
    ADD CONSTRAINT "mission_tool_usage_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_tool_usage"
    ADD CONSTRAINT "mission_tool_usage_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_qa_assigned_to_fkey" FOREIGN KEY ("qa_assigned_to") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parts_history"
    ADD CONSTRAINT "parts_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."parts_orders"("id");



ALTER TABLE ONLY "public"."parts_history"
    ADD CONSTRAINT "parts_history_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parts_orders"
    ADD CONSTRAINT "parts_orders_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parts"
    ADD CONSTRAINT "parts_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scoring_prompts"
    ADD CONSTRAINT "scoring_prompts_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_vicinities"
    ADD CONSTRAINT "storage_vicinities_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tool_audits"
    ADD CONSTRAINT "tool_audits_audited_by_fkey" FOREIGN KEY ("audited_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."tool_audits"
    ADD CONSTRAINT "tool_audits_last_user_identified_fkey" FOREIGN KEY ("last_user_identified") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."tool_audits"
    ADD CONSTRAINT "tool_audits_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tool_audits"
    ADD CONSTRAINT "tool_audits_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id");



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tools"
    ADD CONSTRAINT "tools_parent_structure_id_fkey" FOREIGN KEY ("parent_structure_id") REFERENCES "public"."tools"("id");



ALTER TABLE ONLY "public"."worker_attributes"
    ADD CONSTRAINT "worker_attributes_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_attributes"
    ADD CONSTRAINT "worker_attributes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_performance"
    ADD CONSTRAINT "worker_performance_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_performance"
    ADD CONSTRAINT "worker_performance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_strategic_attributes"
    ADD CONSTRAINT "worker_strategic_attributes_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_strategic_attributes"
    ADD CONSTRAINT "worker_strategic_attributes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can create audits" ON "public"."tool_audits" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("audited_by" = "auth"."uid"())));



CREATE POLICY "Authenticated users can create issue history" ON "public"."issue_history" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("changed_by" = "auth"."uid"())));



CREATE POLICY "Authenticated users can create parts orders" ON "public"."parts_orders" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("ordered_by" = "auth"."uid"())));



CREATE POLICY "Authenticated users can create prompts" ON "public"."scoring_prompts" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Authenticated users can create storage vicinities" ON "public"."storage_vicinities" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Authenticated users can insert parts history" ON "public"."parts_history" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can manage checkins" ON "public"."checkins" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can manage suppliers" ON "public"."suppliers" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can track inventory usage" ON "public"."inventory_usage" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can track tool usage" ON "public"."mission_tool_usage" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update parts orders" ON "public"."parts_orders" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update prompts" ON "public"."scoring_prompts" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update storage vicinities" ON "public"."storage_vicinities" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can upload attachments" ON "public"."mission_attachments" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view active storage vicinities" ON "public"."storage_vicinities" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_active" = true)));



CREATE POLICY "Authenticated users can view inventory usage" ON "public"."inventory_usage" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view issue history" ON "public"."issue_history" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view mission attachments" ON "public"."mission_attachments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view mission tool usage" ON "public"."mission_tool_usage" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view parts history" ON "public"."parts_history" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view parts orders" ON "public"."parts_orders" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view prompts" ON "public"."scoring_prompts" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view suppliers" ON "public"."suppliers" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view tool audits" ON "public"."tool_audits" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Leadership can manage all attributes" ON "public"."worker_attributes" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"]))))));



CREATE POLICY "Leadership can manage all strategic attributes" ON "public"."worker_strategic_attributes" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"]))))));



CREATE POLICY "Leadership can view all checkins" ON "public"."checkins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"]))))));



CREATE POLICY "Leadership can view all checkouts" ON "public"."checkouts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"]))))));



CREATE POLICY "Leadership can view all performance" ON "public"."worker_performance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins can manage members" ON "public"."organization_members" USING ((("organization_id" = "public"."get_user_organization_id"()) AND "public"."is_organization_admin"()));



CREATE POLICY "Organization admins can manage missions" ON "public"."missions" USING ((("organization_id" = "public"."get_user_organization_id"()) AND "public"."is_organization_admin"()));



CREATE POLICY "Organization admins can update their organization" ON "public"."organizations" FOR UPDATE USING ((("id" = "public"."get_user_organization_id"()) AND "public"."is_organization_admin"()));



CREATE POLICY "Organization admins can view organization member profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om1"
     JOIN "public"."organization_members" "om2" ON (("om1"."organization_id" = "om2"."organization_id")))
  WHERE (("om1"."user_id" = "auth"."uid"()) AND ("om1"."role" = 'admin'::"text") AND ("om2"."user_id" = "profiles"."user_id")))));



CREATE POLICY "Super admins can manage all organization members" ON "public"."organization_members" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all organizations" ON "public"."organizations" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all organization members" ON "public"."organization_members" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "Super admins can view all organizations" ON "public"."organizations" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "System can create performance records" ON "public"."worker_performance" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Tool keepers can manage issue requirements" ON "public"."issue_requirements" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"]))))));



CREATE POLICY "Users can create action scores in their organization" ON "public"."action_scores" FOR INSERT WITH CHECK (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can delete their own attachments or leadership can delete" ON "public"."mission_attachments" FOR DELETE USING ((("uploaded_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "public"."get_user_organization_id"()) AND ("organization_members"."role" = ANY (ARRAY['leadership'::"text", 'admin'::"text"])))))));



CREATE POLICY "Users can delete their own orders" ON "public"."parts_orders" FOR DELETE USING (("ordered_by" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage actions in their organization" ON "public"."actions" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can manage issues in their organization" ON "public"."issues" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can manage parts in their organization" ON "public"."parts" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can manage their own attributes" ON "public"."worker_attributes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own checkouts" ON "public"."checkouts" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can manage their own strategic attributes" ON "public"."worker_strategic_attributes" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage tools in their organization" ON "public"."tools" USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can update action scores in their organization" ON "public"."action_scores" FOR UPDATE USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can update checkin records" ON "public"."checkins" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Users can update their own profile with role protection" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view action scores in their organization" ON "public"."action_scores" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view actions in their organization" ON "public"."actions" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view all strategic attributes" ON "public"."worker_strategic_attributes" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view all worker attributes" ON "public"."worker_attributes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view checkins in their organization" ON "public"."checkins" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view checkouts in their organization" ON "public"."checkouts" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view issue requirements" ON "public"."issue_requirements" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view issues in their organization" ON "public"."issues" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view members of their organization" ON "public"."organization_members" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view missions in their organization" ON "public"."missions" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view parts in their organization" ON "public"."parts" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view their own checkins" ON "public"."checkins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."checkouts"
  WHERE (("checkouts"."id" = "checkins"."checkout_id") AND ("checkouts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own checkouts" ON "public"."checkouts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own full profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own organization" ON "public"."organizations" FOR SELECT USING (("id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view their own performance" ON "public"."worker_performance" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view tools in their organization" ON "public"."tools" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



CREATE POLICY "Users can view worker performance in their organization" ON "public"."worker_performance" FOR SELECT USING (("organization_id" = "public"."get_user_organization_id"()));



ALTER TABLE "public"."action_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mission_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mission_tool_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parts_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parts_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scoring_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."storage_vicinities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tool_audits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_attributes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_performance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_strategic_attributes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."actions";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."capitalize_serial_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."capitalize_serial_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capitalize_serial_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capitalize_tool_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."capitalize_tool_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capitalize_tool_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capitalize_vicinity_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."capitalize_vicinity_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capitalize_vicinity_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_role_update_permission"("target_user_id" "uuid", "old_role" "text", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_role_update_permission"("target_user_id" "uuid", "old_role" "text", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_role_update_permission"("target_user_id" "uuid", "old_role" "text", "new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization_with_admin"("org_name" "text", "org_subdomain" "text", "admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_with_admin"("org_name" "text", "org_subdomain" "text", "admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_with_admin"("org_name" "text", "org_subdomain" "text", "admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_mission_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_mission_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_mission_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_name"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_organization_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_organization_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_organization_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_unauthorized_role_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_unauthorized_role_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_unauthorized_role_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_action_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_action_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_action_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_actions"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_actions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_actions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_checkins"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_checkins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_checkins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_checkouts"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_checkouts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_checkouts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_inventory_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_inventory_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_inventory_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_issue_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_issue_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_issue_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_issue_requirements"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_issue_requirements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_issue_requirements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_issues"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_issues"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_issues"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_mission_attachments"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_mission_attachments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_mission_attachments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_mission_tool_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_mission_tool_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_mission_tool_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_missions"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_missions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_missions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_parts_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_scoring_prompts"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_scoring_prompts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_scoring_prompts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_storage_vicinities"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_storage_vicinities"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_storage_vicinities"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_tool_audits"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_tool_audits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_tool_audits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_tools"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_tools"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_tools"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_attributes"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_attributes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_attributes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_performance"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_performance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_performance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_strategic_attributes"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_strategic_attributes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_for_worker_strategic_attributes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_checkout_operation"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_checkout_operation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_checkout_operation"() TO "service_role";


















GRANT ALL ON TABLE "public"."action_scores" TO "anon";
GRANT ALL ON TABLE "public"."action_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."action_scores" TO "service_role";



GRANT ALL ON TABLE "public"."actions" TO "anon";
GRANT ALL ON TABLE "public"."actions" TO "authenticated";
GRANT ALL ON TABLE "public"."actions" TO "service_role";



GRANT ALL ON TABLE "public"."checkins" TO "anon";
GRANT ALL ON TABLE "public"."checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."checkins" TO "service_role";



GRANT ALL ON TABLE "public"."checkouts" TO "anon";
GRANT ALL ON TABLE "public"."checkouts" TO "authenticated";
GRANT ALL ON TABLE "public"."checkouts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_usage" TO "anon";
GRANT ALL ON TABLE "public"."inventory_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_usage" TO "service_role";



GRANT ALL ON TABLE "public"."issue_history" TO "anon";
GRANT ALL ON TABLE "public"."issue_history" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_history" TO "service_role";



GRANT ALL ON TABLE "public"."issue_requirements" TO "anon";
GRANT ALL ON TABLE "public"."issue_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."issues" TO "anon";
GRANT ALL ON TABLE "public"."issues" TO "authenticated";
GRANT ALL ON TABLE "public"."issues" TO "service_role";



GRANT ALL ON TABLE "public"."mission_attachments" TO "anon";
GRANT ALL ON TABLE "public"."mission_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_attachments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mission_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mission_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mission_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mission_tool_usage" TO "anon";
GRANT ALL ON TABLE "public"."mission_tool_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_tool_usage" TO "service_role";



GRANT ALL ON TABLE "public"."missions" TO "anon";
GRANT ALL ON TABLE "public"."missions" TO "authenticated";
GRANT ALL ON TABLE "public"."missions" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."parts" TO "anon";
GRANT ALL ON TABLE "public"."parts" TO "authenticated";
GRANT ALL ON TABLE "public"."parts" TO "service_role";



GRANT ALL ON TABLE "public"."parts_history" TO "anon";
GRANT ALL ON TABLE "public"."parts_history" TO "authenticated";
GRANT ALL ON TABLE "public"."parts_history" TO "service_role";



GRANT ALL ON TABLE "public"."parts_orders" TO "anon";
GRANT ALL ON TABLE "public"."parts_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."parts_orders" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_prompts" TO "anon";
GRANT ALL ON TABLE "public"."scoring_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."storage_vicinities" TO "anon";
GRANT ALL ON TABLE "public"."storage_vicinities" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_vicinities" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."tool_audits" TO "anon";
GRANT ALL ON TABLE "public"."tool_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."tool_audits" TO "service_role";



GRANT ALL ON TABLE "public"."tools" TO "anon";
GRANT ALL ON TABLE "public"."tools" TO "authenticated";
GRANT ALL ON TABLE "public"."tools" TO "service_role";



GRANT ALL ON TABLE "public"."worker_attributes" TO "anon";
GRANT ALL ON TABLE "public"."worker_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."worker_performance" TO "anon";
GRANT ALL ON TABLE "public"."worker_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_performance" TO "service_role";



GRANT ALL ON TABLE "public"."worker_strategic_attributes" TO "anon";
GRANT ALL ON TABLE "public"."worker_strategic_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_strategic_attributes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
