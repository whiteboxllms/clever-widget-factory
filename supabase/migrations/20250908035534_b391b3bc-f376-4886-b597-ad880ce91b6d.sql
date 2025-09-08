-- Make organization_id have default values so TypeScript treats them as optional in inserts
-- This allows our triggers to set the values automatically without TypeScript errors

-- Update actions table to have a default for organization_id
ALTER TABLE actions ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

-- Update action_scores table to have a default for organization_id  
ALTER TABLE action_scores ALTER COLUMN organization_id SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;