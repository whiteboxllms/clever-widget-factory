-- Fix security warnings by setting search_path for the new functions

-- Update functions to include security definer search_path
CREATE OR REPLACE FUNCTION set_organization_id_for_actions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION set_organization_id_for_action_scores()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;