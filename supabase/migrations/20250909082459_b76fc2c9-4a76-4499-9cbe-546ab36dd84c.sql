-- Add foreign key constraint between actions.assigned_to and organization_members.user_id
-- This will allow PostgREST to properly handle the relationship syntax in queries

ALTER TABLE actions 
ADD CONSTRAINT fk_actions_assigned_to_organization_members 
FOREIGN KEY (assigned_to) 
REFERENCES organization_members(user_id) 
ON DELETE SET NULL;