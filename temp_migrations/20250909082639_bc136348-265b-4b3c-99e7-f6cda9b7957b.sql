-- First create a unique constraint on organization_members.user_id
-- Then add the foreign key constraint between actions.assigned_to and organization_members.user_id

-- Create unique constraint on user_id in organization_members table
ALTER TABLE organization_members 
ADD CONSTRAINT unique_organization_members_user_id 
UNIQUE (user_id);

-- Now add the foreign key constraint
ALTER TABLE actions 
ADD CONSTRAINT fk_actions_assigned_to_organization_members 
FOREIGN KEY (assigned_to) 
REFERENCES organization_members(user_id) 
ON DELETE SET NULL;