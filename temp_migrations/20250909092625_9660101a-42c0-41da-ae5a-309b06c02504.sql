-- Remove the inappropriate role check trigger from profiles table
-- The profiles table doesn't have a role column, so this trigger should only be on organization_members table
DROP TRIGGER IF EXISTS profile_role_update_check ON public.profiles;