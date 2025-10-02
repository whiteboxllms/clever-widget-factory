-- Fix the invitation flow by ensuring invited users are added to the correct organization
-- The issue is that automatic triggers might be overriding the organization_id

-- First, let's see what triggers exist on organization_members table
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'organization_members';

-- Remove any triggers that might be auto-setting organization_id for organization_members
-- since invitations need to explicitly set the organization they're being invited to
DROP TRIGGER IF EXISTS set_organization_id_trigger ON organization_members;