-- Create triggers to automatically set organization_id for actions and action_scores

-- Function to set organization_id for actions
CREATE OR REPLACE FUNCTION set_organization_id_for_actions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set organization_id for action_scores  
CREATE OR REPLACE FUNCTION set_organization_id_for_action_scores()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER trigger_set_organization_id_actions
  BEFORE INSERT ON actions
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id_for_actions();

CREATE TRIGGER trigger_set_organization_id_action_scores
  BEFORE INSERT ON action_scores
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id_for_action_scores();